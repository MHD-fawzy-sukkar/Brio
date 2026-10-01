import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import type { PublishedQuizSnapshot } from '@brio/game-core';

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

class MockWebSocket {
  sentMessages: string[] = [];
  readyState = 1;

  send(data: string) {
    this.sentMessages.push(data);
  }
}

// Generate a published quiz with N questions
function generateMockQuiz(questionCount: number): PublishedQuizSnapshot {
  const questions = [];
  for (let i = 1; i <= questionCount; i++) {
    questions.push({
      id: `q_${i}`,
      type: 'MultipleChoice' as const,
      text: `Load Test Question #${i}: What is the correct answer?`,
      durationMs: 20000,
      multiplier: 'Standard' as const,
      essentialImage: i % 3 === 0 ? `https://res.cloudinary.com/demo/image/upload/sample_${i}.jpg` : null,
      options: [
        { id: `opt_${i}_1`, text: 'Option 1 (Correct)', isCorrect: true },
        { id: `opt_${i}_2`, text: 'Option 2', isCorrect: false },
        { id: `opt_${i}_3`, text: 'Option 3', isCorrect: false },
        { id: `opt_${i}_4`, text: 'Option 4', isCorrect: false }
      ],
      acceptedAlternatives: []
    });
  }

  return {
    id: 'quiz_load_150',
    title: '150-Player Local Load Rehearsal Quiz',
    revision: 1,
    questions
  };
}

describe('Phase P6 — Correctness Hardening & 150-Player Local Rehearsal', () => {

  describe('T01 & Harness — 150 Players x 30 Questions Load Simulation & Burst Testing', () => {
    it('simulates 150 concurrent players across 30 questions with near-deadline bursts', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_load_150' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      const quiz = generateMockQuiz(30);
      await doInstance.initQuizSnapshot(quiz);

      const playerCount = 150;
      const playerIds: string[] = [];

      // 1. Join 150 Players
      for (let i = 1; i <= playerCount; i++) {
        const pId = `player_${i}`;
        await doInstance.fetch(
          new Request('http://internal/join', {
            method: 'POST',
            body: JSON.stringify({
              playerId: pId,
              nickname: `Player_${i}`,
              avatarId: `avatar_${(i % 6) + 1}`,
              sessionHash: `hash_${i}`
            })
          })
        );
        playerIds.push(pId);
      }

      assert.equal(doInstance.state.players.size, 150);

      // 2. Start Quiz (Host)
      const hostWs = new MockWebSocket();
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));

      // Process COUNTDOWN -> Q1
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'QUESTION');

      // 3. Execute 30 Questions Loop
      for (let qIdx = 0; qIdx < 30; qIdx++) {
        const roundId = doInstance.state.activeRound!.roundId;

        // Near-deadline answer burst: Submit answers from all 150 players in parallel using fresh socket instances per round
        const submitPromises = playerIds.map(async (pId) => {
          const ws = new MockWebSocket();
          const reqId = `req_${qIdx}_${pId}`;
          const subId = `sub_${qIdx}_${pId}`;
          const selectedOption = `opt_${qIdx + 1}_${(parseInt(pId.split('_')[1]) % 4) + 1}`;

          await doInstance.webSocketMessage(
            ws as any,
            JSON.stringify({
              type: 'answer.submit',
              requestId: reqId,
              payload: {
                playerId: pId,
                roundId,
                submissionId: subId,
                optionId: selectedOption
              }
            })
          );

          // Retry submission with duplicate submissionId to test idempotency (dropped ACK simulation)
          if (pId === 'player_1' || pId === 'player_50') {
            const retryWs = new MockWebSocket();
            await doInstance.webSocketMessage(
              retryWs as any,
              JSON.stringify({
                type: 'answer.submit',
                requestId: `retry_${reqId}`,
                payload: {
                  playerId: pId,
                  roundId,
                  submissionId: subId,
                  optionId: selectedOption
                }
              })
            );
          }
        });

        await Promise.all(submitPromises);

        // Advance Question -> STATS -> LEADERBOARD -> Next QUESTION (or FINISHED)
        doInstance.state.activeRound!.endsAt = Date.now() - 1000;
        await doInstance.alarm(); // STATS
        doInstance.state.activeRound!.statsEndsAt = Date.now() - 1000;
        await doInstance.alarm(); // LEADERBOARD
        doInstance.state.activeRound!.rankingEndsAt = Date.now() - 1000;
        await doInstance.alarm(); // Next QUESTION or FINISHED
      }

      assert.equal(doInstance.state.phase, 'FINISHED');

      // Fetch aggregated metrics from DO
      const metricsRes = await doInstance.fetch(new Request('http://internal/metrics'));
      const metrics = (await metricsRes.json()) as any;

      assert.equal(metrics.playerCount, 150);
      assert.equal(metrics.totalSubmissions, 4500 + 60); // 150 players * 30 Qs + 60 duplicate retries
      assert.equal(metrics.duplicateSubmissions, 60);
      assert.equal(metrics.totalReceiptsEmitted, 4500 + 60);

      // Verify latency calculations
      assert.ok(typeof metrics.p50AckMs === 'number');
      assert.ok(typeof metrics.p95AckMs === 'number');
    });
  });

  describe('T20 — NAT-Safe Admission & IP Ceilings', () => {
    it('allows 150 players from a single NAT IP to join a live room successfully', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_nat_test' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(generateMockQuiz(2));

      // Simulate 150 players joining from same NAT IP (e.g. 198.51.100.45)
      for (let i = 1; i <= 150; i++) {
        const res = await doInstance.fetch(
          new Request('http://internal/join', {
            method: 'POST',
            headers: { 'CF-Connecting-IP': '198.51.100.45' },
            body: JSON.stringify({
              playerId: `nat_player_${i}`,
              nickname: `NAT_Player_${i}`,
              avatarId: 'avatar_1',
              sessionHash: `hash_nat_${i}`
            })
          })
        );
        assert.equal(res.status, 200);
      }

      assert.equal(doInstance.state.players.size, 150);
    });
  });

  describe('T25 — Two Rooms Concurrently', () => {
    it('runs two independent rooms with 150 players each with zero cross-room leaks', async () => {
      const storage1 = createMockDoStorage();
      const storage2 = createMockDoStorage();

      const roomA = new GameRoomDO({ id: { toString: () => 'room_A' }, storage: storage1, getWebSockets: () => [], acceptWebSocket: () => {} } as any, {} as any);
      const roomB = new GameRoomDO({ id: { toString: () => 'room_B' }, storage: storage2, getWebSockets: () => [], acceptWebSocket: () => {} } as any, {} as any);

      await roomA.initQuizSnapshot(generateMockQuiz(5));
      await roomB.initQuizSnapshot(generateMockQuiz(5));

      // Join 150 players to Room A, 150 players to Room B
      for (let i = 1; i <= 150; i++) {
        await roomA.fetch(new Request('http://internal/join', { method: 'POST', body: JSON.stringify({ playerId: `pA_${i}`, nickname: `NickA_${i}`, avatarId: 'a1', sessionHash: `hA_${i}` }) }));
        await roomB.fetch(new Request('http://internal/join', { method: 'POST', body: JSON.stringify({ playerId: `pB_${i}`, nickname: `NickB_${i}`, avatarId: 'a2', sessionHash: `hB_${i}` }) }));
      }

      assert.equal(roomA.state.players.size, 150);
      assert.equal(roomB.state.players.size, 150);

      // Verify no cross-room player IDs
      assert.equal(roomA.state.players.has('pB_1'), false);
      assert.equal(roomB.state.players.has('pA_1'), false);
    });
  });

  describe('Security Audit — Payload Redaction & Size Guards', () => {
    it('rejects WebSocket messages exceeding 4 KiB limit', async () => {
      const storage = createMockDoStorage();
      const doInstance = new GameRoomDO({ id: { toString: () => 'room_size_guard' }, storage, getWebSockets: () => [], acceptWebSocket: () => {} } as any, {} as any);
      await doInstance.initQuizSnapshot(generateMockQuiz(1));

      const ws = new MockWebSocket();
      const oversizedPayload = JSON.stringify({
        type: 'answer.submit',
        padding: 'X'.repeat(5000) // 5KB payload > 4KB limit
      });

      await doInstance.webSocketMessage(ws as any, oversizedPayload);
      const reply = JSON.parse(ws.sentMessages[0]);
      assert.equal(reply.type, 'error');
      assert.equal(reply.payload.code, 'message_too_large');
    });

    it('rejects short answers exceeding 200 characters limit', async () => {
      const storage = createMockDoStorage();
      const doInstance = new GameRoomDO({ id: { toString: () => 'room_short_guard' }, storage, getWebSockets: () => [], acceptWebSocket: () => {} } as any, {} as any);

      const quizShort: PublishedQuizSnapshot = {
        id: 'quiz_short',
        title: 'Short Answer Test',
        revision: 1,
        questions: [{
          id: 'q_sa',
          type: 'ShortAnswer',
          text: 'Short answer Q',
          durationMs: 20000,
          multiplier: 'Standard',
          options: [],
          acceptedAlternatives: ['Cairo']
        }]
      };
      await doInstance.initQuizSnapshot(quizShort);

      await doInstance.fetch(new Request('http://internal/join', { method: 'POST', body: JSON.stringify({ playerId: 'p1', nickname: 'Ali', avatarId: 'a1', sessionHash: 'h1' }) }));

      const hostWs = new MockWebSocket();
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm(); // QUESTION phase

      const ws = new MockWebSocket();
      await doInstance.webSocketMessage(ws as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_sa_over',
        payload: {
          playerId: 'p1',
          roundId: doInstance.state.activeRound!.roundId,
          submissionId: 'sub_sa',
          textAnswer: 'A'.repeat(250) // 250 chars > 200 chars limit
        }
      }));

      const reply = JSON.parse(ws.sentMessages[0]);
      assert.equal(reply.type, 'answer.rejected');
      assert.ok(reply.payload.reason.includes('200 characters'));
    });
  });

});
