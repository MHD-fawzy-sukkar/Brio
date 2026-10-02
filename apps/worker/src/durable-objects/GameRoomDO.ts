import {
  createInitialGameState,
  startQuiz,
  endQuiz,
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
import { markRoomFinished } from '../repositories/room-directory.repository';

export interface Env {
  DB: D1Database;
  GAME_ROOM: any;
  ASSETS: any;
  GOOGLE_CLIENT_ID?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  DEV_AUTH_BYPASS?: string;
  DEV_MEDIA_BYPASS?: string;
}

export interface RoomMetrics {
  totalSubmissions: number;
  totalReceiptsEmitted: number;
  duplicateSubmissions: number;
  rejectedSubmissions: number;
  ackLatenciesMs: number[];
  p50AckMs: number;
  p95AckMs: number;
}

export class GameRoomDO {
  ctx: any;
  env: Env;
  state!: GameState;
  quizSnapshot: PublishedQuizSnapshot | null = null;
  initialized = false;

  // Rate limiting map: WebSocket -> array of message timestamps in last 1000ms
  private socketMessageTimestamps: Map<WebSocket, number[]> = new Map();

  // Metrics tracking (aggregated & bounded)
  private metrics: RoomMetrics = {
    totalSubmissions: 0,
    totalReceiptsEmitted: 0,
    duplicateSubmissions: 0,
    rejectedSubmissions: 0,
    ackLatenciesMs: [],
    p50AckMs: 0,
    p95AckMs: 0
  };

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

    if (this.state.phase === 'FINISHED' && this.state.roomId && this.env.DB) {
      await markRoomFinished(this.env.DB, this.state.roomId);
    }
  }

  broadcastState(): void {
    if (!this.quizSnapshot) return;

    // Broadcast to Host WebSocket
    const hostSockets = this.ctx.getWebSockets('role:host');
    for (const ws of hostSockets) {
      const snapshot = toPublicHostSnapshot(this.state, this.quizSnapshot);
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'room.snapshot',
          stateVersion: this.state.stateVersion,
          serverNow: Date.now(),
          payload: snapshot
        })
      );
    }

    // Broadcast to Player WebSockets
    for (const player of this.state.players.values()) {
      const playerSockets = this.ctx.getWebSockets(`player:${player.id}`);
      for (const ws of playerSockets) {
        const snapshot = toPublicPlayerSnapshot(this.state, player.id, this.quizSnapshot);
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'room.snapshot',
            stateVersion: this.state.stateVersion,
            serverNow: Date.now(),
            payload: snapshot
          })
        );
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);

    // 1. Initial DO Setup HTTP endpoint (for Worker Room Creation)
    if (url.pathname.endsWith('/setup') && request.method === 'POST') {
      const body = (await request.json()) as any;
      if (body.quizSnapshot) {
        this.state.roomId = body.roomId;
        await this.initQuizSnapshot({ ...body.quizSnapshot, roomCode: body.code });
        return new Response(JSON.stringify({ status: 'ok', roomId: this.ctx.id.toString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.endsWith('/close') && request.method === 'POST') {
      const effects = endQuiz(this.state);
      await this.applyEffects(effects);
      return new Response(JSON.stringify({ status: 'finished' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Player Join HTTP endpoint
    if (url.pathname.endsWith('/join') && request.method === 'POST') {
      if (!this.quizSnapshot) return new Response(JSON.stringify({ detail: 'Game not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      if (this.state.phase !== 'LOBBY') return new Response(JSON.stringify({ detail: 'Game has already started' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      const body = (await request.json()) as any;
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

      return new Response(
        JSON.stringify({
          status: 'ok',
          playerId: player.id,
          nickname: player.nickname,
          avatarId: player.avatarId
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Media Manifest endpoint
    if (url.pathname.endsWith('/media')) {
      if (!this.quizSnapshot) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
      }
      const items = this.quizSnapshot.questions
        .filter((q) => q.essentialImage)
        .map((q, idx) => ({
          mediaId: q.id,
          url: q.essentialImage!,
          questionIndex: idx,
          isEssential: true
        }));
      return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Aggregated Metrics endpoint
    if (url.pathname.endsWith('/metrics')) {
      this.calculateLatencyPercentiles();
      return new Response(
        JSON.stringify({
          ...this.metrics,
          ackLatenciesMs: undefined, // Hide raw array, show summary
          playerCount: this.state.players.size,
          phase: this.state.phase,
          stateVersion: this.state.stateVersion
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. WebSocket Upgrade Request
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
          server.send(
            JSON.stringify({
              v: 1,
              type: 'room.snapshot',
              stateVersion: this.state.stateVersion,
              serverNow: Date.now(),
              payload: snapshot
            })
          );
        } else if (playerId && this.state.players.has(playerId)) {
          const snapshot = toPublicPlayerSnapshot(this.state, playerId, this.quizSnapshot);
          server.send(
            JSON.stringify({
              v: 1,
              type: 'room.snapshot',
              stateVersion: this.state.stateVersion,
              serverNow: Date.now(),
              payload: snapshot
            })
          );
        }
      }

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // 6. HTTP Snapshot Fallback
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

    const arrivalTime = Date.now();

    // SRS Guard 1: Frame Size Limit (max 4 KiB = 4096 bytes)
    const byteLen = typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength;
    if (byteLen > 4096) {
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'error',
          serverNow: arrivalTime,
          payload: { code: 'message_too_large', detail: 'Inbound socket payload exceeds 4 KiB limit' }
        })
      );
      return;
    }

    // SRS Guard 2: Per-connection Rate Limiter (max 10 msgs / second)
    const timestamps = this.socketMessageTimestamps.get(ws) || [];
    const recentTimestamps = timestamps.filter((t) => arrivalTime - t < 1000);
    if (recentTimestamps.length >= 10) {
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'error',
          serverNow: arrivalTime,
          payload: { code: 'rate_limit_exceeded', detail: 'Too many socket messages. Max 10 per second' }
        })
      );
      return;
    }
    recentTimestamps.push(arrivalTime);
    this.socketMessageTimestamps.set(ws, recentTimestamps);

    try {
      const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(msgStr);
      const now = Date.now();

      // 1. Clock Sample
      if (data.type === 'clock.sample') {
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'clock.sample',
            serverNow: now,
            payload: { t0: data.payload?.t0 }
          })
        );
        return;
      }

      // 2. Answer Submission (Transactional & Durable ACK with Latency Tracking)
      if (data.type === 'answer.submit') {
        this.metrics.totalSubmissions++;

        // Short Answer payload length guard (max 200 chars)
        if (data.payload?.textAnswer && typeof data.payload.textAnswer === 'string' && data.payload.textAnswer.length > 200) {
          ws.send(
            JSON.stringify({
              v: 1,
              type: 'answer.rejected',
              requestId: data.requestId,
              serverNow: now,
              payload: { reason: 'Short answer text exceeds maximum length of 200 characters' }
            })
          );
          this.metrics.rejectedSubmissions++;
          return;
        }

        const answerKey = `${data.payload.roundId}:${data.payload.playerId || data.playerId}`;
        const isDuplicate = this.state.answers.has(answerKey);

        const result = processAnswerSubmission(
          this.state,
          this.quizSnapshot,
          {
            playerId: data.payload.playerId || data.playerId,
            roundId: data.payload.roundId,
            submissionId: data.payload.submissionId,
            optionId: data.payload.optionId,
            textAnswer: data.payload.textAnswer
          },
          now
        );

        if (result.status === 'accepted' || result.status === 'duplicate') {
          if (isDuplicate || result.status === 'duplicate') {
            this.metrics.duplicateSubmissions++;
          }

          // Commit Answer to SQLite Storage FIRST before sending ACK!
          const sql = this.ctx.storage.sql;
          const answerRecord = this.state.answers.get(answerKey);
          if (answerRecord) {
            saveAnswerToDb(sql, answerRecord);
          }

          const ackTime = Date.now();
          const latency = ackTime - arrivalTime;
          this.metrics.ackLatenciesMs.push(latency);
          // Keep bounded latency window
          if (this.metrics.ackLatenciesMs.length > 1000) {
            this.metrics.ackLatenciesMs.shift();
          }

          this.metrics.totalReceiptsEmitted++;

          ws.send(
            JSON.stringify({
              v: 1,
              type: 'answer.receipt',
              requestId: data.requestId,
              serverNow: ackTime,
              payload: result.receipt
            })
          );
        } else {
          this.metrics.rejectedSubmissions++;
          ws.send(
            JSON.stringify({
              v: 1,
              type: 'answer.rejected',
              requestId: data.requestId,
              serverNow: now,
              payload: { reason: result.reason }
            })
          );
        }
        return;
      }

      // 3. Host Controls
      if (data.type === 'host.start') {
        const effects = startQuiz(this.state, this.quizSnapshot, now);
        await this.applyEffects(effects);
        return;
      }

      if (data.type === 'host.end') {
        const effects = endQuiz(this.state);
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
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'error',
          serverNow: Date.now(),
          payload: { code: 'bad_request', detail: err.message || 'Invalid socket frame' }
        })
      );
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.socketMessageTimestamps.delete(ws);
  }

  private calculateLatencyPercentiles(): void {
    const latencies = [...this.metrics.ackLatenciesMs].sort((a, b) => a - b);
    if (latencies.length === 0) {
      this.metrics.p50AckMs = 0;
      this.metrics.p95AckMs = 0;
      return;
    }

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);

    this.metrics.p50AckMs = latencies[p50Index] || latencies[0];
    this.metrics.p95AckMs = latencies[p95Index] || latencies[latencies.length - 1];
  }
}
