import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { reserveRoomSlot, findRoomByCode, finishRoomForCreator } from '../repositories/room-directory.repository';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { toPublicPlayerSnapshot, toPublicHostSnapshot, type PublishedQuizSnapshot } from '@brio/game-core';

// Mock D1 Database implementation backed by node:sqlite
function createMockD1Database(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE room_directory (
      room_id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      creator_id TEXT NOT NULL,
      quiz_version_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reservation_expires_at TEXT NOT NULL,
      event_expires_at TEXT NOT NULL
    );
  `);

  return {
    prepare(query: string) {
      return {
        bind(...args: any[]) {
          return {
            async first<T = any>(): Promise<T | null> {
              const stmt = db.prepare(query);
              const result = stmt.get(...args) as any;
              return result || null;
            },
            async all<T = any>(): Promise<{ results: T[] }> {
              const stmt = db.prepare(query);
              const results = stmt.all(...args) as any[];
              return { results };
            },
            async run() {
              const stmt = db.prepare(query);
              const info = stmt.run(...args);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        }
      } as any;
    }
  } as unknown as D1Database;
}

// Mock DO Storage SQLite implementation backed by node:sqlite
function createMockDoStorage() {
  const db = new DatabaseSync(':memory:');
  let currentAlarm: number | null = null;

  return {
    sql: {
      exec(query: string, ...bindings: any[]) {
        if (bindings.length === 0) {
          if (query.trim().toUpperCase().startsWith('SELECT')) {
            return db.prepare(query).all();
          } else {
            db.exec(query);
            return [];
          }
        }
        const stmt = db.prepare(query);
        if (query.trim().toUpperCase().startsWith('SELECT')) {
          return stmt.all(...bindings);
        } else {
          stmt.run(...bindings);
          return [];
        }
      }
    },
    async setAlarm(scheduledTime: number) {
      currentAlarm = scheduledTime;
    },
    async getAlarm() {
      return currentAlarm;
    },
    async deleteAlarm() {
      currentAlarm = null;
    }
  };
}

// Mock WebSocket implementation for DO testing
class MockWebSocket {
  sentMessages: string[] = [];
  readyState = 1;

  send(data: string) {
    this.sentMessages.push(data);
  }
}

const mockQuizSnapshot: PublishedQuizSnapshot = {
  id: 'quiz_v1',
  title: 'P4 Test Quiz',
  revision: 1,
  questions: [
    {
      id: 'q1',
      type: 'MultipleChoice',
      text: 'What is 2 + 2?',
      durationMs: 30000,
      multiplier: 'Standard',
      options: [
        { id: 'opt_1', text: '3', isCorrect: false },
        { id: 'opt_2', text: '4', isCorrect: true },
        { id: 'opt_3', text: '5', isCorrect: false },
        { id: 'opt_4', text: '6', isCorrect: false }
      ],
      acceptedAlternatives: []
    },
    {
      id: 'q2',
      type: 'ShortAnswer',
      text: 'Capital of France?',
      durationMs: 30000,
      multiplier: 'Standard',
      options: [],
      acceptedAlternatives: ['paris', 'باريس']
    }
  ]
};

describe('Phase P4 — Integration Tests', () => {

  describe('D1 Pilot Capacity Reservations', () => {
    it('replaces a creator stale room and still enforces the global ceiling', async () => {
      const db = createMockD1Database();

      // Creator 1 reserves room 1 -> Success
      const r1 = await reserveRoomSlot(db, 'creator_1', 'qv_1');
      assert.ok(r1.roomId);
      assert.equal(r1.code.length, 6);

      // A second start by the same creator gracefully replaces the stale room.
      const replacement = await reserveRoomSlot(db, 'creator_1', 'qv_2');
      assert.deepEqual(replacement.replacedRoomIds, [r1.roomId]);
      assert.equal(await findRoomByCode(db, r1.code), null);

      // Creator 2 reserves room 2 -> Success (Global count = 2)
      const r2 = await reserveRoomSlot(db, 'creator_2', 'qv_3');
      assert.ok(r2.roomId);

      // Creator 3 attempts to reserve room 3 -> Fails (Global Capacity 2 Reached)
      await assert.rejects(
        () => reserveRoomSlot(db, 'creator_3', 'qv_4'),
        /Global pilot capacity reached/
      );

      // Verify PIN lookup works for Creator 1's replacement room
      const found = await findRoomByCode(db, replacement.code);
      assert.ok(found);
      assert.equal(found.room_id, replacement.roomId);
      assert.equal(found.status, 'reserved');
    });

    it('allows start, explicit end, and immediate restart without creator quota lockout', async () => {
      const db = createMockD1Database();
      const first = await reserveRoomSlot(db, 'creator_restart', 'qv_1');
      assert.ok(await findRoomByCode(db, first.code));

      assert.equal(await finishRoomForCreator(db, first.roomId, 'creator_restart'), true);
      assert.equal(await findRoomByCode(db, first.code), null);

      const second = await reserveRoomSlot(db, 'creator_restart', 'qv_2');
      assert.ok(second.roomId);
      assert.notEqual(second.roomId, first.roomId);
      assert.deepEqual(second.replacedRoomIds, []);
    });

    it('synchronizes Durable Object finish to D1 before an immediate new room', async () => {
      const db = createMockD1Database();
      const first = await reserveRoomSlot(db, 'creator_do_finish', 'qv_1');
      const storage = createMockDoStorage();
      const ctx = {
        id: { toString: () => first.roomId }, storage,
        getWebSockets: () => [], acceptWebSocket: () => {}
      };
      const room = new GameRoomDO(ctx as any, { DB: db } as any);
      await room.fetch(new Request('http://internal/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: first.roomId, code: first.code, quizSnapshot: mockQuizSnapshot })
      }));
      const closed = await room.fetch(new Request('http://internal/close', { method: 'POST' }));
      assert.equal(closed.status, 200);
      assert.equal(await findRoomByCode(db, first.code), null);

      const second = await reserveRoomSlot(db, 'creator_do_finish', 'qv_2');
      assert.ok(second.roomId);
      assert.deepEqual(second.replacedRoomIds, []);
    });
  });

  describe('GameRoomDO SQLite Wake & State Reconstruction', () => {
    it('reconstructs full game state from SQLite on cold wake', async () => {
      const storage = createMockDoStorage();
      const doId = 'room_123';
      const mockCtx = {
        id: { toString: () => doId },
        storage: storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      // 1. First DO instance initializes snapshot and adds player
      const do1 = new GameRoomDO(mockCtx as any, {} as any);
      await do1.initQuizSnapshot(mockQuizSnapshot);

      await do1.fetch(new Request('http://internal/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'p_101',
          nickname: 'Ahmad',
          avatarId: 'avatar_1',
          sessionHash: 'hash_101'
        })
      }));

      assert.equal(do1.state.players.size, 1);
      assert.equal(do1.state.players.get('p_101')?.nickname, 'Ahmad');

      // 2. Simulate cold wake (New DO instance with SAME storage)
      const do2 = new GameRoomDO(mockCtx as any, {} as any);
      await do2.ensureInitialized();

      // State and Quiz snapshot must be fully reconstructed
      assert.equal(do2.quizSnapshot?.id, 'quiz_v1');
      assert.equal(do2.state.roomId, doId);
      assert.equal(do2.state.players.size, 1);
      assert.equal(do2.state.players.get('p_101')?.nickname, 'Ahmad');
    });
  });

  describe('Transactional Answer Submissions & Durable ACK', () => {
    it('persists answer to SQLite before returning durable receipt ACK', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_ans' },
        storage: storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizSnapshot);

      // Add player and start quiz
      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p_1', nickname: 'Ali', avatarId: 'avatar_1', sessionHash: 'h1' })
      }));

      const ws = new MockWebSocket();
      await doInstance.webSocketMessage(ws as any, JSON.stringify({ type: 'host.start' }));
      assert.equal(doInstance.state.phase, 'COUNTDOWN');

      // Countdown finishes -> Question round begins
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'QUESTION');

      const activeRound = doInstance.state.activeRound;
      assert.ok(activeRound);

      // Submit answer via WebSocket
      const submissionId = 'sub_001';
      await doInstance.webSocketMessage(ws as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_1',
        payload: {
          playerId: 'p_1',
          roundId: activeRound.roundId,
          submissionId,
          optionId: 'opt_2'
        }
      }));

      // Verify receipt ACK sent to client
      assert.equal(ws.sentMessages.length, 1);
      const ackMsg = JSON.parse(ws.sentMessages[0]);
      assert.equal(ackMsg.type, 'answer.receipt');
      assert.equal(ackMsg.payload.status, 'accepted');

      // Verify answer was written to SQLite storage
      const sqlRows = storage.sql.exec('SELECT * FROM answers WHERE submission_id = ?', submissionId);
      assert.equal(sqlRows.length, 1);
      assert.equal(sqlRows[0].player_id, 'p_1');
    });

    it('rejects late answers submitted after round endsAt', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_late' },
        storage: storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizSnapshot);

      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p_1', nickname: 'Ali', avatarId: 'avatar_1', sessionHash: 'h1' })
      }));

      const ws = new MockWebSocket();
      await doInstance.webSocketMessage(ws as any, JSON.stringify({ type: 'host.start' }));

      // Countdown finishes -> Question round begins
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'QUESTION');

      // Force round endsAt into the past
      if (doInstance.state.activeRound) {
        doInstance.state.activeRound.endsAt = Date.now() - 5000;
      }

      await doInstance.webSocketMessage(ws as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_2',
        payload: {
          playerId: 'p_1',
          roundId: doInstance.state.activeRound!.roundId,
          submissionId: 'sub_late',
          optionId: 'opt_2'
        }
      }));

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      assert.equal(lastMsg.type, 'answer.rejected');
      assert.equal(lastMsg.payload.reason, 'Answer submitted outside question time deadline');
    });
  });

  describe('Role Isolation & Answer Key Protection', () => {
    it('redacts answer key and correct options from player snapshots', () => {
      const state = {
        roomId: 'room_sec',
        quizVersionId: mockQuizSnapshot.id,
        phase: 'QUESTION' as const,
        stateVersion: 1,
        currentQuestionIndex: 0,
        activeRound: {
          roundId: 'r1',
          questionIndex: 0,
          questionId: 'q1',
          type: 'MultipleChoice' as const,
          startsAt: Date.now(),
          endsAt: Date.now() + 30000,
          statsEndsAt: Date.now() + 35000,
          rankingEndsAt: Date.now() + 40000,
          closed: false,
          scored: false
        },
        players: new Map([['p_1', { id: 'p_1', nickname: 'Sara', avatarId: 'a1', score: 100, joinedAt: Date.now(), connectionGeneration: 1 }]]),
        answers: new Map(),
        submissionIds: new Set<string>(),
        pausedQueued: false,
        interruptedRoundId: null
      };

      const playerSnapshot = toPublicPlayerSnapshot(state, 'p_1', mockQuizSnapshot);

      // Player snapshot MUST NOT expose correct options
      assert.ok(playerSnapshot.question);
      const question = playerSnapshot.question as any;
      if (question.options) {
        for (const opt of question.options) {
          assert.equal(opt.isCorrect, undefined);
        }
      }
      assert.equal((question as any).acceptedAlternatives, undefined);

      // Host snapshot has host view
      const hostSnapshot = toPublicHostSnapshot(state, mockQuizSnapshot);
      assert.ok(hostSnapshot);
      assert.equal(hostSnapshot.phase, 'QUESTION');
    });
  });

  describe('Full 3-Client + Host Game Simulation', () => {
    it('runs complete quiz timeline with 3 players and 2 questions', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_sim' },
        storage: storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizSnapshot);

      // 3 Players join
      for (const [id, nick] of [['p1', 'Omar'], ['p2', 'Fatima'], ['p3', 'Yara']]) {
        await doInstance.fetch(new Request('http://internal/join', {
          method: 'POST',
          body: JSON.stringify({ playerId: id, nickname: nick, avatarId: 'avatar_1', sessionHash: `hash_${id}` })
        }));
      }
      assert.equal(doInstance.state.players.size, 3);

      const hostWs = new MockWebSocket();

      // 1. Host Starts Game -> COUNTDOWN
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
      assert.equal(doInstance.state.phase, 'COUNTDOWN');
      assert.equal(doInstance.state.currentQuestionIndex, 0);

      // 2. Alarm triggers -> QUESTION 1 phase (Q1 MultipleChoice)
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'QUESTION');

      const round1 = doInstance.state.activeRound!;

      // 3. Players Submit Answers for Q1
      // p1 submits correct (opt_2), p2 submits wrong (opt_1), p3 submits correct (opt_2)
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p1',
        payload: { playerId: 'p1', roundId: round1.roundId, submissionId: 'sub_r1_p1', optionId: 'opt_2' }
      }));
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p2',
        payload: { playerId: 'p2', roundId: round1.roundId, submissionId: 'sub_r1_p2', optionId: 'opt_1' }
      }));
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p3',
        payload: { playerId: 'p3', roundId: round1.roundId, submissionId: 'sub_r1_p3', optionId: 'opt_2' }
      }));

      // 4. Trigger Alarm -> Advances to STATS phase (Q1 scored)
      round1.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'STATS');

      // Check player scores after Q1
      assert.ok(doInstance.state.players.get('p1')!.score > 0);
      assert.equal(doInstance.state.players.get('p2')!.score, 0);
      assert.ok(doInstance.state.players.get('p3')!.score > 0);

      // Score persistence survives a Durable Object cold wake (prefix sum source of truth).
      const coldWake = new GameRoomDO(mockCtx as any, {} as any);
      await coldWake.ensureInitialized();
      assert.equal(coldWake.state.players.get('p1')!.score, doInstance.state.players.get('p1')!.score);
      assert.equal(coldWake.state.players.get('p2')!.score, 0);

      // 5. Trigger Alarm -> Advances to LEADERBOARD phase
      round1.statsEndsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'LEADERBOARD');

      // 6. Trigger Alarm -> LEADERBOARD ends -> Starts Q2 directly in QUESTION phase!
      round1.rankingEndsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'QUESTION');
      assert.equal(doInstance.state.currentQuestionIndex, 1);

      const round2 = doInstance.state.activeRound!;

      // Players Submit Short Answer text for Q2
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'r2_p1',
        payload: { playerId: 'p1', roundId: round2.roundId, submissionId: 'sub_r2_p1', textAnswer: 'Paris' }
      }));
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'r2_p2',
        payload: { playerId: 'p2', roundId: round2.roundId, submissionId: 'sub_r2_p2', textAnswer: 'باريس' }
      }));

      // 7. Complete Q2 timeline -> STATS -> LEADERBOARD -> FINISHED
      round2.endsAt = Date.now() - 1000;
      await doInstance.alarm(); // STATS
      round2.statsEndsAt = Date.now() - 1000;
      await doInstance.alarm(); // LEADERBOARD
      round2.rankingEndsAt = Date.now() - 1000;
      await doInstance.alarm(); // FINISHED

      assert.equal(doInstance.state.phase, 'FINISHED');
      assert.equal(doInstance.state.players.get('p2')!.score > 0, true); // Arabic answer matched!
    });
  });

});
