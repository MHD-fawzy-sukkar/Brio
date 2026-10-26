import { Hono } from 'hono';
import { validateOrigin } from '../auth/session';
import { findJoinableRoomById } from '../repositories/room-directory.repository';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.all('/ws/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  if (!roomId) {
    return rfc7807Error(c, 400, 'bad_request', 'Room ID is required');
  }

  if (!validateOrigin(c.req.raw)) {
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin WebSocket upgrade denied');
  }

  const room = await findJoinableRoomById(c.env.DB, roomId);
  if (!room) return rfc7807Error(c, 404, 'room_not_found', 'Game not found or expired');
  if (c.req.query('role') === 'host') {
    const creator = await getAuthCreator(c);
    if (!creator || creator.id !== room.creator_id)
      return rfc7807Error(c, 401, 'unauthorized', 'Host authentication required');
  }

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
