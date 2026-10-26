import { Hono } from 'hono';
import { getLatestQuizVersion } from '../repositories/quiz.repository';
import {
  reserveRoomSlot,
  finishRoomForCreator,
  findRoomForCreator,
} from '../repositories/room-directory.repository';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.post('/api/rooms', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  if (!body.quizId || typeof body.quizId !== 'string') {
    return rfc7807Error(c, 400, 'validation_failed', 'quizId is required');
  }

  const versionRecord = await getLatestQuizVersion(c.env.DB, body.quizId);
  if (!versionRecord) {
    return rfc7807Error(c, 400, 'quiz_not_published', 'Quiz must be published before creating a room');
  }

  let quizSnapshot: any;
  try {
    quizSnapshot = JSON.parse(versionRecord.private_snapshot_json);
  } catch {
    return rfc7807Error(c, 500, 'internal_error', 'Corrupted quiz version snapshot');
  }

  try {
    const reservation = await reserveRoomSlot(c.env.DB, creator.id, versionRecord.id);

    // Close replaced Durable Objects after their directory slots are released.
    // A failed best-effort close cannot lock the creator out again because D1 is authoritative.
    await Promise.allSettled(
      reservation.replacedRoomIds.map(async (roomId) => {
        const oldId = c.env.GAME_ROOM.idFromName(roomId);
        await c.env.GAME_ROOM.get(oldId).fetch(new Request('http://internal/close', { method: 'POST' }));
      }),
    );

    const doId = c.env.GAME_ROOM.idFromName(reservation.roomId);
    const stub = c.env.GAME_ROOM.get(doId);

    const setupRes = await stub.fetch(
      new Request('http://internal/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: reservation.roomId,
          code: reservation.code,
          creatorId: creator.id,
          quizSnapshot,
        }),
      }),
    );

    if (!setupRes.ok) {
      await finishRoomForCreator(c.env.DB, reservation.roomId, creator.id);
      return rfc7807Error(c, 500, 'do_setup_failed', 'Failed to initialize room Durable Object');
    }

    return c.json({ roomId: reservation.roomId, code: reservation.code }, 201);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'room_creation_denied', err.message);
  }
});

app.delete('/api/rooms/:roomId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  const roomId = c.req.param('roomId');
  const room = await findRoomForCreator(c.env.DB, roomId, creator.id);
  if (!room) return rfc7807Error(c, 404, 'room_not_found', 'Room not found or access denied');

  await finishRoomForCreator(c.env.DB, roomId, creator.id);
  const id = c.env.GAME_ROOM.idFromName(roomId);
  await c.env.GAME_ROOM.get(id)
    .fetch(new Request('http://internal/close', { method: 'POST' }))
    .catch(() => null);
  return c.json({ status: 'finished' });
});

export default app;
