import type { Context } from 'hono';
import type { Env } from '../durable-objects/GameRoomDO';
import { parseCookies, SESSION_COOKIE_NAME, hashSessionToken } from '../auth/session';
import { findCreatorBySessionHash } from '../repositories/creator.repository';

export async function getAuthCreator(c: Pick<Context<{ Bindings: Env }>, 'req' | 'env'>) {
  const token = parseCookies(c.req.header('Cookie') || null)[SESSION_COOKIE_NAME];
  return token ? findCreatorBySessionHash(c.env.DB, await hashSessionToken(token)) : null;
}
