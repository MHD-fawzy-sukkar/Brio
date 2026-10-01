/**
 * Creator Session and Cookie Management for Cloudflare Worker
 */

export const SESSION_COOKIE_NAME = 'brio_creator_session';
export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SessionInfo {
  sessionToken: string;
  sessionHash: string;
  expiresAt: string;
}

export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSessionInfo(): Promise<SessionInfo> {
  const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
  const sessionHash = await hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();

  return {
    sessionToken,
    sessionHash,
    expiresAt
  };
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[name] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function buildSessionCookie(token: string, isProduction: boolean): string {
  const sameSite = isProduction ? 'None' : 'Lax';
  const secure = isProduction ? '; Secure' : '';
  const maxAge = Math.floor(SESSION_LIFETIME_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`;
}

export function buildLogoutCookie(isProduction: boolean): string {
  const sameSite = isProduction ? 'None' : 'Lax';
  const secure = isProduction ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`;
}

/**
 * Validates Origin header for state-changing HTTP requests (POST, PATCH, PUT, DELETE)
 */
export function validateOrigin(request: Request, allowedOrigins?: string[]): boolean {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true; // Read-only methods don't require CSRF origin check
  }

  const origin = request.headers.get('Origin');
  if (!origin) {
    // If no Origin header present on mutation, check Referer
    const referer = request.headers.get('Referer');
    if (!referer) return true; // Local direct request
    const url = new URL(request.url);
    const refUrl = new URL(referer);
    return refUrl.origin === url.origin;
  }

  const requestUrl = new URL(request.url);
  if (origin === requestUrl.origin) {
    return true; // Same origin allowed
  }

  if (allowedOrigins && allowedOrigins.includes(origin)) {
    return true;
  }

  return false;
}
