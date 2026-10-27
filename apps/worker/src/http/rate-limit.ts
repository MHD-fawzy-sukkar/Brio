import type { Context } from 'hono';
import type { Env } from '../env';
import { hashSessionToken, parseCookies, SESSION_COOKIE_NAME } from '../auth/session';
import { rfc7807Error } from './problem';

export async function enforceRequestLimit(c: Context<{ Bindings: Env }>) {
  const path = c.req.path;
  const ip = c.req.header('CF-Connecting-IP') || 'local';
  const auth = path === '/api/auth/google';
  const entry = path.startsWith('/ws/') || path.startsWith('/api/rooms/by-code/') || /\/join$/.test(path);
  const upload = path === '/api/identity-assets/signature' || path === '/api/media/signature';
  const limiter = auth
    ? c.env.AUTH_LIMITER
    : entry
      ? c.env.ENTRY_LIMITER
      : upload
        ? c.env.UPLOAD_LIMITER
        : undefined;
  if (!limiter) return;
  // Shared event NATs need room for 200 attendees and reconnects. Uploads use an account session key.
  const session = upload ? parseCookies(c.req.header('Cookie') || null)[SESSION_COOKIE_NAME] : undefined;
  const key = session
    ? `upload:${await hashSessionToken(session)}`
    : `${auth ? 'auth' : entry ? 'entry' : 'upload'}:${ip}`;
  if (!(await limiter.limit({ key })).success) {
    c.header('Retry-After', '60');
    return rfc7807Error(c, 429, 'rate_limit_exceeded', 'Too many requests. Try again shortly.');
  }
}
