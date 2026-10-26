import { Hono } from 'hono';
import { verifyGoogleIdToken } from '../auth/google';
import {
  parseCookies,
  buildSessionCookie,
  buildLogoutCookie,
  createSessionInfo,
  hashSessionToken,
  validateOrigin,
  SESSION_COOKIE_NAME,
} from '../auth/session';
import {
  findOrCreateCreator,
  createSessionRecord,
  revokeSessionRecord,
} from '../repositories/creator.repository';
import { GoogleAuthRequestSchema } from '@brio/contracts';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/auth/nonce', (c) => {
  const nonce = crypto.randomUUID();
  return c.json({ nonce, timestamp: Date.now() });
});

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
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Validation failed for Google auth request',
      parsed.error.flatten().fieldErrors,
    );
  }

  const clientId = (c.env as any).GOOGLE_CLIENT_ID || 'mock-google-client-id.apps.googleusercontent.com';
  const allowDevBypass = (c.env as any).DEV_AUTH_BYPASS === 'true';

  let googlePayload;
  try {
    googlePayload = await verifyGoogleIdToken(parsed.data.idToken, clientId, {
      allowDevBypass,
    });
  } catch (err: any) {
    return rfc7807Error(c, 401, 'unauthorized', `Google token validation failed: ${err.message}`);
  }

  const creator = await findOrCreateCreator(
    c.env.DB,
    googlePayload.sub,
    googlePayload.email,
    googlePayload.name,
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
      createdAt: creator.created_at,
    },
    expiresAt: session.expiresAt,
  });
});

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
      createdAt: creator.created_at,
    },
  });
});

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

export default app;
