import {
  createInitialGameState,
  startQuiz,
  processAnswerSubmission,
  reconcileDeadlines,
  requestPause,
  requestResume,
  handleOverdueRecovery,
  toPublicPlayerSnapshot,
  toPublicHostSnapshot,
  type GameState,
  type PublishedQuizSnapshot,
  type PlayerState,
  type EngineEffect
} from '@brio/game-core';
import {
  initRoomDbSchema,
  loadGameStateFromDb,
  loadQuizSnapshotFromDb,
  saveQuizSnapshotToDb,
  savePlayerToDb,
  saveRoundToDb,
  saveAnswerToDb,
  saveRoomMetaToDb
} from '../rooms/room-storage';

export interface Env {
  DB: D1Database;
  GAME_ROOM: any;
  ASSETS: any;
}

export class GameRoomDO {
  ctx: any;
  env: Env;
  state!: GameState;
  quizSnapshot: PublishedQuizSnapshot | null = null;
  initialized = false;

  constructor(ctx: any, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

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

  async applyEffects(effects: EngineEffect[]): Promise<void> {
    const sql = this.ctx.storage.sql;

    for (const effect of effects) {
      if (effect.type === 'PERSIST_STATE') {
        saveRoomMetaToDb(sql, this.state);
        if (this.state.activeRound) {
          saveRoundToDb(sql, this.state.activeRound);
        }
      } else if (effect.type === 'BROADCAST_STATE') {
        this.broadcastState();
      } else if (effect.type === 'SCHEDULE_ALARM' && effect.dueAt) {
        await this.ctx.storage.setAlarm(effect.dueAt);
      } else if (effect.type === 'CANCEL_ALARM') {
        await this.ctx.storage.deleteAlarm();
      }
    }
  }

  broadcastState(): void {
    if (!this.quizSnapshot) return;

    // Broadcast to Host WebSocket
    const hostSockets = this.ctx.getWebSockets('role:host');
    for (const ws of hostSockets) {
      const snapshot = toPublicHostSnapshot(this.state, this.quizSnapshot);
      ws.send(JSON.stringify({
        v: 1,
        type: 'room.snapshot',
        stateVersion: this.state.stateVersion,
        serverNow: Date.now(),
        payload: snapshot
      }));
    }

    // Broadcast to Player WebSockets
    for (const player of this.state.players.values()) {
      const playerSockets = this.ctx.getWebSockets(`player:${player.id}`);
      for (const ws of playerSockets) {
        const snapshot = toPublicPlayerSnapshot(this.state, player.id, this.quizSnapshot);
        ws.send(JSON.stringify({
          v: 1,
          type: 'room.snapshot',
          stateVersion: this.state.stateVersion,
          serverNow: Date.now(),
          payload: snapshot
        }));
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);

    // 1. Initial DO Setup HTTP endpoint (for Worker Room Creation)
    if (url.pathname.endsWith('/setup') && request.method === 'POST') {
      const body = await request.json() as any;
      if (body.quizSnapshot) {
        await this.initQuizSnapshot(body.quizSnapshot);
        return new Response(JSON.stringify({ status: 'ok', roomId: this.ctx.id.toString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Player Join HTTP endpoint
    if (url.pathname.endsWith('/join') && request.method === 'POST') {
      const body = await request.json() as any;
      const { playerId, nickname, avatarId, sessionHash } = body;

      let player = this.state.players.get(playerId);
      if (!player) {
        player = {
          id: playerId,
          nickname,
          avatarId,
          score: 0,
          joinedAt: Date.now(),
          connectionGeneration: 1
        };
        this.state.players.set(playerId, player);
      } else {
        player.connectionGeneration++;
      }

      const sql = this.ctx.storage.sql;
      savePlayerToDb(sql, player, sessionHash);
      saveRoomMetaToDb(sql, this.state);

      this.broadcastState();

      return new Response(JSON.stringify({
        status: 'ok',
        playerId: player.id,
        nickname: player.nickname,
        avatarId: player.avatarId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. WebSocket Upgrade Request
    if (url.pathname.startsWith('/ws/')) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const role = url.searchParams.get('role') || 'player';
      const playerId = url.searchParams.get('playerId') || '';

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const tag = role === 'host' ? 'role:host' : `player:${playerId}`;
      this.ctx.acceptWebSocket(server, [tag]);

      // Send immediate snapshot on connect
      if (this.quizSnapshot) {
        if (role === 'host') {
          const snapshot = toPublicHostSnapshot(this.state, this.quizSnapshot);
          server.send(JSON.stringify({
            v: 1,
            type: 'room.snapshot',
            stateVersion: this.state.stateVersion,
            serverNow: Date.now(),
            payload: snapshot
          }));
        } else if (playerId && this.state.players.has(playerId)) {
          const snapshot = toPublicPlayerSnapshot(this.state, playerId, this.quizSnapshot);
          server.send(JSON.stringify({
            v: 1,
            type: 'room.snapshot',
            stateVersion: this.state.stateVersion,
            serverNow: Date.now(),
            payload: snapshot
          }));
        }
      }

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // 4. HTTP Snapshot Fallback
    if (url.pathname.endsWith('/snapshot')) {
      const playerId = url.searchParams.get('playerId');
      if (playerId && this.state.players.has(playerId) && this.quizSnapshot) {
        const snapshot = toPublicPlayerSnapshot(this.state, playerId, this.quizSnapshot);
        return new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } });
      } else if (this.quizSnapshot) {
        const snapshot = toPublicHostSnapshot(this.state, this.quizSnapshot);
        return new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ status: 'active', DO: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    if (!this.quizSnapshot) return;

    const now = Date.now();
    const effects = reconcileDeadlines(this.state, this.quizSnapshot, now);
    await this.applyEffects(effects);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    if (!this.quizSnapshot) return;

    try {
      const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(msgStr);
      const now = Date.now();

      // 1. Clock Sample
      if (data.type === 'clock.sample') {
        ws.send(JSON.stringify({
          v: 1,
          type: 'clock.sample',
          serverNow: now,
          payload: { t0: data.payload?.t0 }
        }));
        return;
      }

      // 2. Answer Submission (Transactional & Durable ACK)
      if (data.type === 'answer.submit') {
        const result = processAnswerSubmission(this.state, this.quizSnapshot, {
          playerId: data.payload.playerId || data.playerId,
          roundId: data.payload.roundId,
          submissionId: data.payload.submissionId,
          optionId: data.payload.optionId,
          textAnswer: data.payload.textAnswer
        }, now);

        if (result.status === 'accepted' || result.status === 'duplicate') {
          // Commit Answer to SQLite Storage FIRST before sending ACK!
          const sql = this.ctx.storage.sql;
          const key = `${data.payload.roundId}:${data.payload.playerId || data.playerId}`;
          const answerRecord = this.state.answers.get(key);
          if (answerRecord) {
            saveAnswerToDb(sql, answerRecord);
          }

          ws.send(JSON.stringify({
            v: 1,
            type: 'answer.receipt',
            requestId: data.requestId,
            serverNow: now,
            payload: result.receipt
          }));
        } else {
          ws.send(JSON.stringify({
            v: 1,
            type: 'answer.rejected',
            requestId: data.requestId,
            serverNow: now,
            payload: { reason: result.reason }
          }));
        }
        return;
      }

      // 3. Host Controls
      if (data.type === 'host.start') {
        const effects = startQuiz(this.state, this.quizSnapshot, now);
        await this.applyEffects(effects);
        return;
      }

      if (data.type === 'host.pause') {
        const effects = requestPause(this.state);
        await this.applyEffects(effects);
        return;
      }

      if (data.type === 'host.resume') {
        const effects = requestResume(this.state, this.quizSnapshot, now);
        await this.applyEffects(effects);
        return;
      }

      if (data.type === 'host.recover') {
        const action = data.payload?.action || 'void_and_replay';
        const effects = handleOverdueRecovery(this.state, action, this.quizSnapshot, now);
        await this.applyEffects(effects);
        return;
      }

    } catch (err: any) {
      ws.send(JSON.stringify({
        v: 1,
        type: 'error',
        serverNow: Date.now(),
        payload: { code: 'bad_request', detail: err.message || 'Invalid socket frame' }
      }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Sockets close silently without interrupting room timeline
  }
}
