import type { CreatorParticipationStats } from '@brio/contracts';
import type { Env } from '../durable-objects/GameRoomDO';

type Room = { room_id: string; status: string; event_expires_at: string };
const BATCH_SIZE = 8;
const FRESH_FOR = 60_000;
/** Read a compact D1 snapshot immediately; cold rooms never block the dashboard. */
export async function readCreatorParticipationStats(db: D1Database, creatorId: string): Promise<CreatorParticipationStats> {
  const row = await db.prepare(`SELECT COALESCE(SUM(p.total),0) AS total,
    COALESCE(SUM(CASE WHEN p.room_id IS NULL OR (p.finalized=0 AND p.updated_at<?) THEN 1 ELSE 0 END),0) AS pending
    FROM room_directory r LEFT JOIN creator_room_participations p ON p.room_id=r.room_id WHERE r.creator_id=?`)
    .bind(Date.now()-FRESH_FOR, creatorId).first<{total:number;pending:number}>();
  return {totalParticipations:Number(row?.total??0),pending:Number(row?.pending??0)>0};
}
/** Completed rooms are reconciled once; only live rooms need a fresh object read. */
export async function creatorParticipationStats(env: Pick<Env, 'DB' | 'GAME_ROOM'>, creatorId: string): Promise<CreatorParticipationStats> {
  const { results } = await env.DB.prepare(`SELECT r.room_id,r.status,r.event_expires_at FROM room_directory r
    LEFT JOIN creator_room_participations p ON p.room_id=r.room_id
    WHERE r.creator_id=? AND (p.room_id IS NULL OR (p.finalized=0 AND p.updated_at<?))
    ORDER BY CASE WHEN r.status IN ('reserved','active') THEN 0 ELSE 1 END,r.event_expires_at ASC LIMIT ?`)
    .bind(creatorId,Date.now()-FRESH_FOR,BATCH_SIZE+1).all<Room>();
  const rooms = results ?? [];
  let cursor=0;
  const deadline=Date.now()+18000;
  await Promise.all(Array.from({length:Math.min(2,rooms.length,BATCH_SIZE)},async()=>{
    while(cursor<Math.min(rooms.length,BATCH_SIZE)) {
      if(Date.now()>=deadline) throw new Error('Participation reconciliation timed out');
      const room=rooms[cursor++];
      const stub=env.GAME_ROOM.get(env.GAME_ROOM.idFromName(room.room_id));
      const response=await stub.fetch(new Request('http://internal/participations',{signal:AbortSignal.timeout(Math.max(1,Math.min(8000,deadline-Date.now())))}));
      if(!response.ok) throw new Error('Participation snapshot unavailable');
      const snapshot=await response.json() as {count:unknown;finished:unknown};
      if(typeof snapshot.count!=='number'||!Number.isSafeInteger(snapshot.count)||snapshot.count<0) throw new Error('Invalid participation count');
      const settled = snapshot.finished === true || (['finished','expired'].includes(room.status) && Date.parse(room.event_expires_at)<Date.now()-60000);
      await env.DB.prepare(`INSERT INTO creator_room_participations(room_id,total,finalized,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(room_id) DO UPDATE SET total=MAX(creator_room_participations.total,excluded.total),finalized=MAX(creator_room_participations.finalized,excluded.finalized),updated_at=excluded.updated_at`)
        .bind(room.room_id,snapshot.count,settled?1:0,Date.now()).run();
    }
  }));
  return readCreatorParticipationStats(env.DB,creatorId);
}
