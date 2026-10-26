import type { GameState, PublishedQuizSnapshot, EngineEffect } from '@brio/game-core';
import type { Env } from '../../env';
import type { SqlStorageLike } from '../../rooms/room-storage';
export interface RoomSocket {
  send(message: string): void;
}
export interface RoomContext {
  id: { toString(): string };
  storage: { sql: SqlStorageLike; setAlarm(time: number): Promise<void>; deleteAlarm(): Promise<void> };
  getWebSockets(tag: string): RoomSocket[];
  acceptWebSocket(socket: WebSocket, tags: string[]): void;
  getTags(socket: WebSocket): string[];
}
export interface RoomRuntime {
  ctx: RoomContext;
  env: Env;
  state: GameState;
  quizSnapshot: PublishedQuizSnapshot | null;
  ensureInitialized(): Promise<void>;
  initQuizSnapshot(snapshot: PublishedQuizSnapshot): Promise<void>;
  applyEffects(effects: EngineEffect[]): Promise<void>;
  broadcastState(): void;
}
