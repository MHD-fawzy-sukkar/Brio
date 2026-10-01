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
  updateQuizTitle,
  deleteQuizForCreator,
  addQuestionToQuiz,
  deleteQuestionFromQuiz,
  reorderQuizQuestions,
  publishQuizVersion
} from './repositories/quiz.repository';
import {
  GoogleAuthRequestSchema,
  SaveQuizRequestSchema,
  AuthoringQuestionSchema
} from '@brio/contracts';

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

  const session = await createSessionInfo();
  await createSessionRecord(c.env.DB, creator.id, session.sessionHash, session.expiresAt);

  const isProd = (c.env as any).NODE_ENV === 'production';
  const cookieHeader = buildSessionCookie(session.sessionToken, isProd);

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
    const quiz = await createQuizForCreator(c.env.DB, creator.id, parsed.data.title, parsed.data.questions);
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

  if (!body.title || typeof body.title !== 'string') {
    return rfc7807Error(c, 400, 'validation_failed', 'Title string is required');
  }

  try {
    await updateQuizTitle(c.env.DB, quizId, creator.id, body.title);
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

// 15. Diagnostic WebSocket route upgrade to Durable Object
app.all('/ws/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  if (!roomId) {
    return rfc7807Error(c, 400, 'bad_request', 'Room ID is required');
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

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return app.fetch(request, env, ctx);
  }
};
