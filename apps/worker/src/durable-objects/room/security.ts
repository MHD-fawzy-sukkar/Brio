import { hashSessionToken } from '../../auth/session';
import type { RoomRuntime } from './runtime';
import { findCreatorBySessionHash } from '../../repositories/creator.repository';

export async function verifyHostCommand(room: RoomRuntime, ws: WebSocket) {
  const hash = room.ctx
    .getTags(ws)
    .find((tag) => tag.startsWith('host-session:'))
    ?.slice(13);
  return !!hash && !!(await findCreatorBySessionHash(room.env.DB, hash));
}

export async function verifyPlayerSession(room: RoomRuntime, playerId: string, token: string) {
  if (!token || !room.state.players.has(playerId)) return false;
  const rows = Array.from(
    room.ctx.storage.sql.exec('SELECT session_hash FROM players WHERE player_id = ? LIMIT 1', playerId),
  ) as { session_hash: string }[];
  return rows[0]?.session_hash === (await hashSessionToken(token));
}

export function socketIdentity(room: RoomRuntime, ws: WebSocket) {
  const tags = room.ctx.getTags(ws);
  const playerId = tags.find((tag) => tag.startsWith('player:'))?.slice(7);
  const player = playerId ? room.state.players.get(playerId) : undefined;
  return {
    host: tags.includes('role:host'),
    playerId: player && tags.includes(`generation:${player.connectionGeneration}`) ? playerId : undefined,
  };
}
