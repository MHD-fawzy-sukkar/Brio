import type { GameState, PublishedQuizSnapshot, EngineEffect } from '@brio/game-core';
import {
  initRoomDbSchema,
  loadGameStateFromDb,
  loadQuizSnapshotFromDb,
  saveQuizSnapshotToDb,
  saveRoomMetaToDb,
} from '../rooms/room-storage';
import type { Env } from '../env';
import type { RoomContext, RoomRuntime } from './room/runtime';
import { RoomTelemetry } from './room/telemetry';
import { fetch as handleHttp } from './room/http';
import { webSocketMessage as handleMessage } from './room/messages';
import { applyEffects as persistEffects, alarm as reconcileAlarm } from './room/effects';
import { broadcastState as broadcast } from './room/broadcast';
export type { Env } from '../env';
export type { RoomMetrics } from './room/telemetry';

/** Cloudflare lifecycle adapter. Game rules, storage effects and transport are separate. */
export class GameRoomDO implements RoomRuntime {
  state!: GameState;
  quizSnapshot: PublishedQuizSnapshot | null = null;
  initialized = false;
  private readonly telemetry = new RoomTelemetry();
  constructor(
    public readonly ctx: RoomContext,
    public readonly env: Env,
  ) {}
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const sql = this.ctx.storage.sql;
    initRoomDbSchema(sql);

    this.quizSnapshot = loadQuizSnapshotFromDb(sql);
    this.state = loadGameStateFromDb(sql, this.ctx.id.toString(), this.quizSnapshot?.id || '');
    this.initialized = true;
  }

  async initQuizSnapshot(snapshot: PublishedQuizSnapshot): Promise<void> {
    await this.ensureInitialized();
    const sql = this.ctx.storage.sql;
    this.quizSnapshot = snapshot;
    saveQuizSnapshotToDb(sql, snapshot);
    this.state.quizVersionId = snapshot.id;
    saveRoomMetaToDb(sql, this.state);
  }
  async applyEffects(effects: EngineEffect[]) {
    await persistEffects(this, this.telemetry, effects);
  }
  broadcastState() {
    broadcast(this, this.telemetry);
  }
  async fetch(request: Request) {
    return handleHttp(this, this.telemetry, request);
  }
  async alarm() {
    await reconcileAlarm(this, this.telemetry);
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await handleMessage(this, this.telemetry, ws, message);
  }
  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.telemetry.timestamps.delete(ws);
  }
}
