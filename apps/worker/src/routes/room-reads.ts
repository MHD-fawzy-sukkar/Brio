import { Hono } from 'hono';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';
import { getAuthCreator } from '../http/creator';
import { findJoinableRoomById } from '../repositories/room-directory.repository';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/rooms/:roomId/snapshot', async (c) => {
  const roomId = c.req.param('roomId');
  const playerId = c.req.query('playerId') || '';
  const headers = new Headers();
  if (playerId) {
    headers.set('X-Brio-Player-Token', c.req.header('Authorization')?.replace(/^Bearer /, '') || '');
  } else {
    const creator = await getAuthCreator(c);
    const room = creator ? await findJoinableRoomById(c.env.DB, roomId) : null;
    // Finished rooms also remain readable by their owner.
    const owner =
      creator &&
      (room ||
        (await c.env.DB.prepare('SELECT creator_id FROM room_directory WHERE room_id = ?')
          .bind(roomId)
          .first<{ creator_id: string }>()));
    if (!creator || !owner || owner.creator_id !== creator.id)
      return rfc7807Error(c, 401, 'unauthorized', 'Host authentication required');
    headers.set('X-Brio-Host', 'verified');
  }

  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const res = await stub.fetch(
    new Request(`http://internal/snapshot?playerId=${encodeURIComponent(playerId)}`, { headers }),
  );
  if (!res.ok) {
    return rfc7807Error(
      c,
      res.status === 401 ? 401 : 404,
      'snapshot_unavailable',
      'Room state snapshot unavailable',
    );
  }

  const data = await res.json();
  return c.json(data);
});

app.get('/api/rooms/:roomId/media', async (c) => {
  const roomId = c.req.param('roomId');
  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const res = await stub.fetch(new Request('http://internal/media'));
  if (!res.ok) {
    return rfc7807Error(c, 404, 'room_not_found', 'Room media manifest unavailable');
  }

  const data = await res.json();
  return c.json(data);
});

app.get('/api/rooms/:roomId/metrics', async (c) => {
  const roomId = c.req.param('roomId');
  const creator = await getAuthCreator(c);
  const room = creator
    ? await c.env.DB.prepare('SELECT creator_id FROM room_directory WHERE room_id = ?')
        .bind(roomId)
        .first<{ creator_id: string }>()
    : null;
  if (!creator || !room || room.creator_id !== creator.id)
    return rfc7807Error(c, 401, 'unauthorized', 'Host authentication required');
  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const res = await stub.fetch(new Request('http://internal/metrics'));
  if (!res.ok) {
    return rfc7807Error(c, 404, 'room_not_found', 'Room metrics unavailable');
  }

  const data = await res.json();
  return c.json(data);
});

export default app;
