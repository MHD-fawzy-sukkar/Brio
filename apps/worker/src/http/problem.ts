import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { localizeProblemDetail } from '../problem-copy';

export function rfc7807Error(c: Context, status: number, code: string, detail: string, errors?: Record<string, string[]>): Response {
  return c.json({ type: `https://httpstatuses.io/${status}`, title: code.replace(/_/g, ' '), status, code,
    traceId: crypto.randomUUID(), detail: localizeProblemDetail(detail), errors }, status as ContentfulStatusCode);
}

export class IdentityError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) { super(message); }
}
