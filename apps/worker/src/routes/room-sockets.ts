import { Hono } from 'hono';
import { validateOrigin, parseCookies, hashSessionToken, SESSION_COOKIE_NAME } from '../auth/session';
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
  const role = c.req.query('role') || 'player';
  if (!['host', 'player'].includes(role)) return rfc7807Error(c, 400, 'bad_request', 'Invalid socket role');
  if (role === 'host') {
    const creator = await getAuthCreator(c);
    if (!creator || creator.id !== room.creator_id)
      return rfc7807Error(c, 401, 'unauthorized', 'Host authentication required');
  }

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);
  const forwarded = new Request(c.req.raw);
  forwarded.headers.delete('X-Brio-Host');
  forwarded.headers.delete('X-Brio-Host-Session');
  if (role === 'host') {
    forwarded.headers.set('X-Brio-Host', 'verified');
    const token = parseCookies(c.req.header('Cookie') || null)[SESSION_COOKIE_NAME];
    forwarded.headers.set('X-Brio-Host-Session', await hashSessionToken(token));
  }
  return stub.fetch(forwarded);
});

export default app;
