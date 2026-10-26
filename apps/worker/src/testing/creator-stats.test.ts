import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createTestDatabase } from './d1';
import { hashSessionToken } from '../auth/session';
import { createQuizForCreator,publishQuizVersion } from '../repositories/quiz.repository';
import { creatorParticipationStats } from '../repositories/creator-stats.repository';
import { initRoomDbSchema,savePlayerToDb,countRoomParticipations } from '../rooms/room-storage';
import worker from '../index';
const poll={type:'Poll' as const,text:'Choose',durationMs:10000,multiplier:'Zero' as const,options:[{text:'A',isCorrect:false},{text:'B',isCorrect:false}],acceptedAlternatives:[]};
async function setup(){
 const {db,sqlite}=createTestDatabase();
 for(const id of ['owner','other']){sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run(id,id,id,`${id}@invalid`,'now');sqlite.prepare('INSERT INTO creator_sessions VALUES(?,?,?,?,?)').run(await hashSessionToken(id),id,'2099-01-01T00:00:00Z',null,'now');}
 const quiz=await createQuizForCreator(db,'owner','Stats',null,[poll]);const version=await publishQuizVersion(db,quiz.id,'owner');
 const add=(id:string,owner='owner',status='finished')=>sqlite.prepare('INSERT INTO room_directory VALUES(?,?,?,?,?,?,?)').run(id,id,owner,version.versionId,status,'2026-01-01','2026-01-01');
 return{db,sqlite,add};
}
test('participation history survives leaving, reconnects, and cold initialization without double counting',()=>{
 const sqlite=new DatabaseSync(':memory:');const sql={exec(query:string,...args:any[]){if(query.trim().startsWith('SELECT'))return sqlite.prepare(query).all(...args);if(args.length)sqlite.prepare(query).run(...args);else sqlite.exec(query);return[];}};
 try{
 initRoomDbSchema(sql);const player={id:'p1',nickname:'P',avatarId:'bolt-avatar-01',score:0,joinedAt:1000,connectionGeneration:1};
 savePlayerToDb(sql,player,'session');savePlayerToDb(sql,{...player,connectionGeneration:2},'session');assert.equal(countRoomParticipations(sql),1);
 sqlite.exec("DELETE FROM players WHERE player_id='p1'");initRoomDbSchema(sql);assert.equal(countRoomParticipations(sql),1);
 savePlayerToDb(sql,{...player,id:'p2'},'second-session');assert.equal(countRoomParticipations(sql),2);
 }finally{sqlite.close();}
});
test('creator totals are owner-scoped, monotonic and finalized rooms are not woken repeatedly',async()=>{
 const {db,sqlite,add}=await setup();try{
 add('finished');add('live','owner','active');add('foreign','other');
 const counts=new Map([['finished',3],['live',2],['foreign',900]]),calls:string[]=[];
 const env={DB:db,GAME_ROOM:{idFromName:(id:string)=>id,get:(id:string)=>({fetch:async()=>{calls.push(id);return Response.json({count:counts.get(id),finished:id!=='live'});}})}};
 assert.deepEqual(await creatorParticipationStats(env,'owner'),{totalParticipations:5,pending:false});
 assert.ok(!calls.includes('foreign'));counts.set('live',1);calls.length=0;sqlite.exec("UPDATE creator_room_participations SET updated_at=0 WHERE room_id='live'");
 assert.equal((await creatorParticipationStats(env,'owner')).totalParticipations,5);assert.deepEqual(calls,['live']);
 counts.set('live',4);sqlite.exec("UPDATE creator_room_participations SET updated_at=0 WHERE room_id='live'");assert.equal((await creatorParticipationStats(env,'owner')).totalParticipations,7);
 }finally{sqlite.close();}
});
test('old rooms reconcile in bounded batches and anonymous requests cannot access the metric',async()=>{
 const {db,sqlite,add}=await setup();try{
 for(let i=0;i<11;i++)add(`room${i}`);
 const env={DB:db,GAME_ROOM:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>Response.json({count:1,finished:true})})}};
 assert.deepEqual(await creatorParticipationStats(env,'owner'),{totalParticipations:8,pending:true});
 assert.deepEqual(await creatorParticipationStats(env,'owner'),{totalParticipations:11,pending:false});
 const call=(cookie:string)=>worker.fetch(new Request('https://brio.invalid/api/creator/stats',{headers:{Cookie:`brio_creator_session=${cookie}`}}),env as never,{waitUntil:()=>{}} as never);
 assert.equal((await call('')).status,401);const response=await call('owner');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{totalParticipations:11,pending:false});
 assert.deepEqual(await(await call('other')).json(),{totalParticipations:0,pending:false});
 }finally{sqlite.close();}
});
test('dashboard reads return the stored count without waiting for a slow room; background failures preserve it',async()=>{
 const {db,sqlite,add}=await setup();try{
 add('slow');sqlite.prepare('INSERT INTO creator_room_participations(room_id,total) VALUES(?,?)').run('slow',7);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const pending:Promise<unknown>[]=[];
 const env={DB:db,GAME_ROOM:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>{await gate;return Response.json({count:9,finished:true});}})}};
 const call=()=>worker.fetch(new Request('https://brio.invalid/api/creator/stats',{headers:{Cookie:'brio_creator_session=owner'}}),env as never,{waitUntil:(task:Promise<unknown>)=>pending.push(task)} as never);
 const response=await call();assert.equal(response.status,200);assert.deepEqual(await response.json(),{totalParticipations:7,pending:true});
 release();await Promise.all(pending);assert.deepEqual(await(await call()).json(),{totalParticipations:9,pending:false});
 sqlite.exec('UPDATE creator_room_participations SET finalized=0,updated_at=0');
 env.GAME_ROOM.get=()=>({fetch:async()=>Response.json({count:-1,finished:true})});
 assert.deepEqual(await(await call()).json(),{totalParticipations:9,pending:true});await Promise.all(pending);
 assert.equal(sqlite.prepare('SELECT total FROM creator_room_participations').get()!.total,9);
 }finally{sqlite.close();}
});
