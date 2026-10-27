import { Hono } from 'hono';
import { hashSessionToken } from '../auth/session';
import { findRoomByCode, findJoinableRoomById } from '../repositories/room-directory.repository';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/rooms/by-code/:code', async (c) => {
  const code = c.req.param('code');
  const room = await findRoomByCode(c.env.DB, code);

  if (!room || room.status === 'finished' || room.status === 'expired') {
    return rfc7807Error(c, 404, 'room_not_found', 'Room not found or code expired');
  }

  return c.json({
    roomId: room.room_id,
    code: room.code,
    status: room.status,
  });
});

app.get('/api/rooms/:roomId/identity', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await findJoinableRoomById(c.env.DB, roomId);
  if (!room) return rfc7807Error(c, 404, 'room_not_found', 'Game not found or expired');
  const response = await c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(roomId)).fetch(
    new Request('http://internal/identity'),
  );
  c.header('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});

app.post('/api/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await findJoinableRoomById(c.env.DB, roomId);
  if (!room) return rfc7807Error(c, 404, 'room_not_found', 'Game not found or no longer accepting players');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
  const avatarId = typeof body?.avatarId === 'string' ? body.avatarId : 'avatar_1';

  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return rfc7807Error(c, 400, 'validation_failed', 'اكتب اسماً مستعاراً بين حرفين و20 حرفاً.');
  }

  const playerId = 'p_' + crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const sessionHash = await hashSessionToken(sessionToken);

  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const joinRes = await stub.fetch(
    new Request('http://internal/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, nickname, avatarId, sessionHash }),
    }),
  );

  if (!joinRes.ok) {
    const problem = (await joinRes.json().catch(() => null)) as { detail?: string } | null;
    return rfc7807Error(
      c,
      joinRes.status === 409 ? 409 : 400,
      'join_failed',
      joinRes.status === 409
        ? 'انتهت هذه اللعبة. اطلب من المضيف رمز الجولة الجديدة.'
        : problem?.detail || 'تعذر الانضمام إلى الغرفة.',
    );
  }

  const secure = new URL(c.req.url).protocol === 'https:' ? '; Secure' : '';
  c.header(
    'Set-Cookie',
    `brio_player_${roomId}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=14400${secure}`,
  );
  return c.json(
    {
      roomId,
      playerId,
      nickname,
      avatarId,
      sessionToken,
    },
    201,
  );
});

app.post('/api/rooms/:roomId/leave', async (c) => {
  const roomId = c.req.param('roomId');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'تعذر قراءة طلب الخروج.');
  }
  if (typeof body?.playerId !== 'string' || typeof body?.sessionToken !== 'string')
    return rfc7807Error(c, 400, 'validation_failed', 'بيانات جلسة اللاعب غير مكتملة.');
  const sessionHash = await hashSessionToken(body.sessionToken);
  const id = c.env.GAME_ROOM.idFromName(roomId);
  const response = await c.env.GAME_ROOM.get(id).fetch(
    new Request('http://internal/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: body.playerId, sessionHash }),
    }),
  );
  const result = (await response.json().catch(() => null)) as any;
  if (!response.ok)
    return rfc7807Error(
      c,
      response.status === 409 ? 409 : 404,
      'leave_failed',
      response.status === 409
        ? 'بدأت اللعبة بالفعل؛ لا يمكن مغادرة غرفة الانتظار الآن.'
        : 'تعذر العثور على جلسة اللاعب.',
    );
  return c.json(result);
});

export default app;
