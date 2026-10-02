import { Hono } from 'hono';
import { GameRoomDO, type Env } from './durable-objects/GameRoomDO';
import {
  verifyGoogleIdToken
} from './auth/google';
import {
  parseCookies,
  buildSessionCookie,
  buildLogoutCookie,
  createSessionInfo,
  hashSessionToken,
  validateOrigin,
  SESSION_COOKIE_NAME
} from './auth/session';
import {
  findOrCreateCreator,
  createSessionRecord,
  findCreatorBySessionHash,
  revokeSessionRecord
} from './repositories/creator.repository';
import {
  listQuizzesForCreator,
  getQuizForCreator,
  createQuizForCreator,
  updateQuizDetails,
  deleteQuizForCreator,
  addQuestionToQuiz,
  updateQuestionInQuiz,
  deleteQuestionFromQuiz,
  reorderQuizQuestions,
  publishQuizVersion,
  getLatestQuizVersion
} from './repositories/quiz.repository';
import {
  reserveRoomSlot,
  findRoomByCode,
  findJoinableRoomById,
  findRoomForCreator,
  finishRoomForCreator
} from './repositories/room-directory.repository';
import {
  GoogleAuthRequestSchema,
  SaveQuizRequestSchema,
  AuthoringQuestionSchema,
  UploadSignatureRequestSchema,
  UploadCompleteRequestSchema
} from '@brio/contracts';
import {
  generateCloudinarySignature,
  saveMediaRecord
} from './repositories/media.repository';

export { GameRoomDO };

const app = new Hono<{ Bindings: Env }>();

// Helper to format RFC 7807 Error Response
function rfc7807Error(c: any, status: number, code: string, detail: string, errors?: Record<string, string[]>) {
  return c.json({
    type: `https://httpstatuses.io/${status}`,
    title: code.replace(/_/g, ' '),
    status,
    code,
    traceId: crypto.randomUUID(),
    detail,
    errors
  }, status);
}

// 1. Health check route
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 2. Nonce and CSRF Bootstrap
app.get('/api/auth/nonce', (c) => {
  const nonce = crypto.randomUUID();
  return c.json({ nonce, timestamp: Date.now() });
});

// Helper for Session Authentication Middleware
async function getAuthCreator(c: any) {
  const cookieHeader = c.req.header('Cookie') || null;
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) return null;

  const sessionHash = await hashSessionToken(sessionToken);
  const creator = await findCreatorBySessionHash(c.env.DB, sessionHash);
  return creator;
}

// 3. Google OAuth Login Endpoint
app.post('/api/auth/google', async (c) => {
  if (!validateOrigin(c.req.raw)) {
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin mutation denied');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = GoogleAuthRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(c, 400, 'validation_failed', 'Validation failed for Google auth request', parsed.error.flatten().fieldErrors);
  }

  const clientId = (c.env as any).GOOGLE_CLIENT_ID || 'mock-google-client-id.apps.googleusercontent.com';
  const allowDevBypass = (c.env as any).DEV_AUTH_BYPASS === 'true';

  let googlePayload;
  try {
    googlePayload = await verifyGoogleIdToken(parsed.data.idToken, clientId, {
      allowDevBypass
    });
  } catch (err: any) {
    return rfc7807Error(c, 401, 'unauthorized', `Google token validation failed: ${err.message}`);
  }

  const creator = await findOrCreateCreator(
    c.env.DB,
    googlePayload.sub,
    googlePayload.email,
    googlePayload.name
  );

  const session = await createSessionInfo(parsed.data.remember);
  await createSessionRecord(c.env.DB, creator.id, session.sessionHash, session.expiresAt);

  const isProd = (c.env as any).NODE_ENV === 'production';
  const cookieHeader = buildSessionCookie(session.sessionToken, isProd, parsed.data.remember);

  c.header('Set-Cookie', cookieHeader);

  return c.json({
    creator: {
      id: creator.id,
      email: creator.email,
      displayName: creator.display_name,
      createdAt: creator.created_at
    },
    expiresAt: session.expiresAt
  });
});

// 4. Current Creator Profile
app.get('/api/auth/me', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  return c.json({
    creator: {
      id: creator.id,
      email: creator.email,
      displayName: creator.display_name,
      createdAt: creator.created_at
    }
  });
});

// 5. Logout Endpoint
app.post('/api/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') || null;
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    const sessionHash = await hashSessionToken(sessionToken);
    await revokeSessionRecord(c.env.DB, sessionHash);
  }

  const isProd = (c.env as any).NODE_ENV === 'production';
  c.header('Set-Cookie', buildLogoutCookie(isProd));

  return c.json({ status: 'logged_out' });
});

// 6. Creator Quiz List (Owner Isolated)
app.get('/api/quizzes', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizzes = await listQuizzesForCreator(c.env.DB, creator.id);
  return c.json(quizzes);
});

// 7. Create Quiz (Owner Isolated)
app.post('/api/quizzes', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  if (!validateOrigin(c.req.raw)) {
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin mutation denied');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON payload');
  }

  const parsed = SaveQuizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(c, 400, 'validation_failed', 'Validation failed for quiz creation', parsed.error.flatten().fieldErrors);
  }

  try {
    const quiz = await createQuizForCreator(c.env.DB, creator.id, parsed.data.title, parsed.data.coverImageUrl, parsed.data.questions);
    return c.json(quiz, 201);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

// 8. Get Quiz Detail (Owner Isolated on READ!)
app.get('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  const quiz = await getQuizForCreator(c.env.DB, quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', `Quiz '${quizId}' not found or access denied`);
  }

  return c.json(quiz);
});

// 9. Update Quiz Title (Owner Isolated)
app.patch('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = SaveQuizRequestSchema.pick({ title: true, coverImageUrl: true }).safeParse(body);
  if (!parsed.success) return rfc7807Error(c, 400, 'validation_failed', 'Valid title and optional cover image are required', parsed.error.flatten().fieldErrors);

  try {
    await updateQuizDetails(c.env.DB, quizId, creator.id, parsed.data.title, parsed.data.coverImageUrl);
    return c.json({ status: 'updated' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

// 10. Delete Quiz (Owner Isolated)
app.delete('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  try {
    await deleteQuizForCreator(c.env.DB, quizId, creator.id);
    return c.json({ status: 'deleted' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

// 11. Add Question to Quiz (Owner Isolated)
app.post('/api/quizzes/:id/questions', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = AuthoringQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(c, 400, 'validation_failed', 'Validation failed for question data', parsed.error.flatten().fieldErrors);
  }

  try {
    const questionId = await addQuestionToQuiz(c.env.DB, quizId, creator.id, parsed.data);
    return c.json({ questionId }, 201);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

// 12. Delete Question (Owner Isolated)
app.delete('/api/quizzes/:id/questions/:questionId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  const questionId = c.req.param('questionId');

  try {
    await deleteQuestionFromQuiz(c.env.DB, quizId, questionId, creator.id);
    return c.json({ status: 'question_deleted' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

app.put('/api/quizzes/:id/questions/:questionId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  let body: unknown;
  try { body = await c.req.json(); } catch { return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body'); }
  const parsed = AuthoringQuestionSchema.safeParse(body);
  if (!parsed.success) return rfc7807Error(c, 400, 'validation_failed', 'Validation failed for question data', parsed.error.flatten().fieldErrors);
  try {
    await updateQuestionInQuiz(c.env.DB, c.req.param('id'), c.req.param('questionId'), creator.id, parsed.data);
    return c.json({ status: 'question_updated' });
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

// 13. Reorder Questions (Owner Isolated & Revision-safe)
app.put('/api/quizzes/:id/question-order', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  if (!Array.isArray(body.questionIds)) {
    return rfc7807Error(c, 400, 'validation_failed', 'questionIds must be an array of string IDs');
  }

  try {
    await reorderQuizQuestions(c.env.DB, quizId, creator.id, body.questionIds);
    return c.json({ status: 'reordered' });
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

// 14. Publish Immutable Quiz Version
app.post('/api/quizzes/:id/publish', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');

  try {
    const published = await publishQuizVersion(c.env.DB, quizId, creator.id);
    return c.json(published);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'publish_failed', err.message);
  }
});

// 14.5 Media Signed Upload Parameters Generation (Creator Owner Isolated)
app.post('/api/media/signature', async (c) => {
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

  const parsed = UploadSignatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(c, 400, 'validation_failed', 'Media upload signature validation failed', parsed.error.flatten().fieldErrors);
  }

  const quiz = await getQuizForCreator(c.env.DB, parsed.data.quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', 'Quiz not found or unauthorized');
  }

  try {
    const sig = await generateCloudinarySignature(c.env as any, creator.id, parsed.data);
    return c.json(sig);
  } catch (err: any) {
    return rfc7807Error(c, 500, 'signature_generation_failed', err.message);
  }
});

// 14.6 Complete Media Upload & Save Eager Variants (Creator Owner Isolated)
app.post('/api/media/complete', async (c) => {
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

  const parsed = UploadCompleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(c, 400, 'validation_failed', 'Media completion validation failed', parsed.error.flatten().fieldErrors);
  }

  const quiz = await getQuizForCreator(c.env.DB, parsed.data.quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', 'Quiz not found or unauthorized');
  }

  try {
    const media = await saveMediaRecord(c.env.DB, creator.id, c.env as any, parsed.data);
    return c.json(media, 201);
  } catch (err: any) {
    return rfc7807Error(c, 500, 'media_save_failed', err.message);
  }
});

// 14.7 Mock Media Upload Fallback Endpoint (for dev/test environments)
app.post('/api/media/mock-upload', async (c) => {
  if (c.env.DEV_MEDIA_BYPASS !== 'true') {
    return rfc7807Error(c, 404, 'not_found', 'Route not found');
  }
  return c.json({
    public_id: 'mock_uploaded_img',
    format: 'webp',
    width: 1280,
    height: 720,
    bytes: 154000
  });
});

// 15. Create Game Room (Owner Authenticated + Pilot Capacity Checks)
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
    await Promise.allSettled(reservation.replacedRoomIds.map(async (roomId) => {
      const oldId = c.env.GAME_ROOM.idFromName(roomId);
      await c.env.GAME_ROOM.get(oldId).fetch(new Request('http://internal/close', { method: 'POST' }));
    }));

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
          quizSnapshot
        })
      })
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

// Explicitly finish a room owned by the authenticated creator.
app.delete('/api/rooms/:roomId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  const roomId = c.req.param('roomId');
  const room = await findRoomForCreator(c.env.DB, roomId, creator.id);
  if (!room) return rfc7807Error(c, 404, 'room_not_found', 'Room not found or access denied');

  await finishRoomForCreator(c.env.DB, roomId, creator.id);
  const id = c.env.GAME_ROOM.idFromName(roomId);
  await c.env.GAME_ROOM.get(id).fetch(new Request('http://internal/close', { method: 'POST' })).catch(() => null);
  return c.json({ status: 'finished' });
});

// 16. PIN Lookup Route
app.get('/api/rooms/by-code/:code', async (c) => {
  const code = c.req.param('code');
  const room = await findRoomByCode(c.env.DB, code);

  if (!room || room.status === 'finished' || room.status === 'expired') {
    return rfc7807Error(c, 404, 'room_not_found', 'Room not found or code expired');
  }

  return c.json({
    roomId: room.room_id,
    code: room.code,
    status: room.status
  });
});

// 17. Player Join Endpoint
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

  const nickname = (body.nickname || '').trim();
  const avatarId = body.avatarId || 'avatar_1';

  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return rfc7807Error(c, 400, 'validation_failed', 'Nickname must be between 2 and 20 characters');
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
      body: JSON.stringify({ playerId, nickname, avatarId, sessionHash })
    })
  );

  if (!joinRes.ok) {
    const problem = await joinRes.json().catch(() => null) as { detail?: string } | null;
    return rfc7807Error(c, joinRes.status === 409 ? 409 : 400, 'join_failed', problem?.detail || 'Failed to join room');
  }

  return c.json({
    roomId,
    playerId,
    nickname,
    avatarId,
    sessionToken
  }, 201);
});

// 18. HTTP Public Room Snapshot
app.get('/api/rooms/:roomId/snapshot', async (c) => {
  const roomId = c.req.param('roomId');
  const playerId = c.req.query('playerId') || '';

  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);

  const res = await stub.fetch(new Request(`http://internal/snapshot?playerId=${encodeURIComponent(playerId)}`));
  if (!res.ok) {
    return rfc7807Error(c, 404, 'room_not_found', 'Room state snapshot unavailable');
  }

  const data = await res.json();
  return c.json(data);
});

// 18.5 Room Media Manifest
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

// 18.6 Aggregated Room Metrics
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

// 19. Diagnostic WebSocket route upgrade to Durable Object
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
    if (!creator || creator.id !== room.creator_id) return rfc7807Error(c, 401, 'unauthorized', 'Host authentication required');
  }

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// Fallback for unknown /api/* and /ws/* routes -> RFC 7807 JSON Error
app.all('/api/*', (c) => {
  return rfc7807Error(c, 404, 'not_found', `API endpoint '${c.req.path}' not found`);
});

app.all('/ws/*', (c) => {
  return rfc7807Error(c, 404, 'not_found', `WebSocket endpoint '${c.req.path}' not found`);
});

// Default fetch handler with static assets fallback
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }

      if (request.method === 'GET' && !url.pathname.includes('.')) {
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        const indexResponse = await env.ASSETS.fetch(indexRequest);
        if (indexResponse.status !== 404) {
          return indexResponse;
        }
      }
    }

    return app.fetch(request, env, ctx);
  }
};
