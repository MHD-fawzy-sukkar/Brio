import { Hono } from 'hono';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/rooms/:roomId/snapshot', async (c) => {
  const roomId = c.req.param('roomId');
  const playerId = c.req.query('playerId') || '';

  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const res = await stub.fetch(
    new Request(`http://internal/snapshot?playerId=${encodeURIComponent(playerId)}`),
  );
  if (!res.ok) {
    return rfc7807Error(c, 404, 'room_not_found', 'Room state snapshot unavailable');
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
