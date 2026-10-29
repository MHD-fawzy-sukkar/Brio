import type { Context } from 'hono';
import type { Env } from '../env';
import { hashSessionToken, parseCookies, SESSION_COOKIE_NAME } from '../auth/session';
import { rfc7807Error } from './problem';

export async function enforceRequestLimit(c: Context<{ Bindings: Env }>) {
  const path = c.req.path;
  const ip = c.req.header('CF-Connecting-IP') || 'local';
  const reject = (seconds: number) => {
    c.header('Retry-After', String(seconds));
    return rfc7807Error(
      c,
      429,
      'rate_limit_exceeded',
      'طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.',
    );
  };
  if ((path.startsWith('/api/') || path.startsWith('/ws/')) && c.env.CLIENT_LIMITER) {
    const previous = parseCookies(c.req.header('Cookie') || null).brio_client;
    const client = /^[a-f0-9-]{36}$/i.test(previous || '') ? previous : crypto.randomUUID();
    if (client !== previous) {
      const secure = new URL(c.req.url).protocol === 'https:' ? '; Secure' : '';
      c.header(
        'Set-Cookie',
        `brio_client=${client}; Path=/; HttpOnly; SameSite=Strict; Max-Age=14400${secure}`,
        { append: true },
      );
    }
    const key = `client:${await hashSessionToken(client)}`;
    if (!(await c.env.CLIENT_LIMITER.limit({ key })).success) return reject(10);
    if (c.env.REQUEST_LIMITER) {
      const response = await c.env.REQUEST_LIMITER.get(c.env.REQUEST_LIMITER.idFromName(key)).fetch(
        'http://internal/limit',
      );
      if (!response.ok) return rfc7807Error(c, 503, 'limiter_unavailable', 'Please try again shortly.');
      const budget = (await response.json()) as { success: boolean; retryAfter?: number };
      if (!budget.success) return reject(budget.retryAfter || 10);
    }
  }
  const auth = path === '/api/auth/google';
  const entry =
    path.startsWith('/ws/') || path.startsWith('/api/rooms/by-code/') || /\/(join|session|leave)$/.test(path);
  const upload = path === '/api/identity-assets/signature' || path === '/api/media/signature';
  if (entry && c.env.ENTRY_LIMITER && !(await c.env.ENTRY_LIMITER.limit({ key: `entry:${ip}` })).success)
    return reject(60);
  const limiter = auth ? c.env.AUTH_LIMITER : upload ? c.env.UPLOAD_LIMITER : undefined;
  if (!limiter) return;
  // Shared event NATs need room for 200 attendees and reconnects. Uploads use an account session key.
  const session = upload ? parseCookies(c.req.header('Cookie') || null)[SESSION_COOKIE_NAME] : undefined;
  const key = session ? `upload:${await hashSessionToken(session)}` : `${auth ? 'auth' : 'upload'}:${ip}`;
  if (!(await limiter.limit({ key })).success) {
    return reject(60);
  }
}
