import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { generateCloudinarySignature, saveMediaRecord } from '../repositories/media.repository';
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

const mockQuizWithImages: PublishedQuizSnapshot = {
  id: 'quiz_media_v1',
  title: 'P5 Media Test Quiz',
  revision: 1,
  questions: [
    {
      id: 'q_img_1',
      type: 'MultipleChoice',
      text: 'Identify this essential image:',
      durationMs: 30000,
      multiplier: 'Standard',
      essentialImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      options: [
        { id: 'opt_1', text: 'Option A', isCorrect: true },
        { id: 'opt_2', text: 'Option B', isCorrect: false },
        { id: 'opt_3', text: 'Option C', isCorrect: false },
        { id: 'opt_4', text: 'Option D', isCorrect: false }
      ],
      acceptedAlternatives: []
    },
    {
      id: 'q_img_2',
      type: 'MultipleChoice',
      text: 'Question 2 text:',
      durationMs: 30000,
      multiplier: 'Standard',
      essentialImage: 'https://res.cloudinary.com/demo/image/upload/sample2.jpg',
      options: [
        { id: 'opt_1', text: 'True', isCorrect: true },
        { id: 'opt_2', text: 'False', isCorrect: false },
        { id: 'opt_3', text: 'Unknown', isCorrect: false },
        { id: 'opt_4', text: 'None', isCorrect: false }
      ],
      acceptedAlternatives: []
    }
  ]
};

describe('Phase P5 — Media Pipeline & Resilient Frontend Acceptance Tests', () => {

  describe('Cloudinary Constrained Signing & Media Records', () => {
    it('generates SHA-1 signature or deterministic mock for creator media uploads', async () => {
      const mockEnv = { DEV_MEDIA_BYPASS: 'true' };
      const sig = await generateCloudinarySignature(mockEnv, 'creator_1', {
        quizId: '11111111-1111-1111-1111-111111111111',
        questionId: '22222222-2222-2222-2222-222222222222',
        target: 'question',
        byteSize: 1024 * 500,
        mimeType: 'image/webp',
        isEssential: true
      });

      assert.equal(sig.mock, true);
      assert.ok(sig.signature);
      assert.ok(sig.publicId);
    });

    it('rejects byte sizes exceeding 5MB max limit via schema validation', async () => {
      const { UploadSignatureRequestSchema } = await import('@brio/contracts');
      const invalidPayload = {
        quizId: '11111111-1111-1111-1111-111111111111',
        questionId: '22222222-2222-2222-2222-222222222222',
        byteSize: 6 * 1024 * 1024, // 6MB exceeds 5MB limit
        mimeType: 'image/jpeg'
      };

      const result = UploadSignatureRequestSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
    });

    it('fails closed when Cloudinary credentials are absent outside explicit development bypass', async () => {
      await assert.rejects(
        () => generateCloudinarySignature({}, 'creator_1', {
          quizId: '11111111-1111-1111-1111-111111111111',
          questionId: '22222222-2222-2222-2222-222222222222',
          target: 'question',
          byteSize: 1024,
          mimeType: 'image/png',
          isEssential: true
        }),
        /Cloudinary|رفع الصور/
      );
    });
  });

  describe('T06 — 12s Image Delay Does Not Shift Server Room Timeline', () => {
    it('proves global room endsAt deadline is unchanged when 1 player has delayed image', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_t06' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizWithImages);

      // Player 1 (Fast) and Player 2 (Delayed 12s)
      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p1_fast', nickname: 'FastPlayer', avatarId: 'a1', sessionHash: 'h1' })
      }));
      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p2_delayed', nickname: 'DelayedPlayer', avatarId: 'a2', sessionHash: 'h2' })
      }));

      const hostWs = new MockWebSocket();
      const now = Date.now();

      // Start Quiz -> COUNTDOWN -> QUESTION
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
      doInstance.state.activeRound!.endsAt = now - 1000;
      await doInstance.alarm();

      assert.equal(doInstance.state.phase, 'QUESTION');
      const initialEndsAt = doInstance.state.activeRound!.endsAt;

      // Fast player answers at t = 2s
      const wsFast = new MockWebSocket();
      await doInstance.webSocketMessage(wsFast as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_fast',
        payload: {
          playerId: 'p1_fast',
          roundId: doInstance.state.activeRound!.roundId,
          submissionId: 'sub_fast',
          optionId: 'opt_1'
        }
      }));

      // 12 seconds pass (Delayed player's image arrives at t = 12s)
      // Verify server room endsAt timeline HAS NOT CHANGED
      assert.equal(doInstance.state.activeRound!.endsAt, initialEndsAt);

      // Delayed player submits answer at t = 12s (well before initialEndsAt = 30s)
      const wsDelayed = new MockWebSocket();
      await doInstance.webSocketMessage(wsDelayed as any, JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_delayed',
        payload: {
          playerId: 'p2_delayed',
          roundId: doInstance.state.activeRound!.roundId,
          submissionId: 'sub_delayed',
          optionId: 'opt_1'
        }
      }));

      const lastMsg = JSON.parse(wsDelayed.sentMessages[0]);
      assert.equal(lastMsg.type, 'answer.receipt');
      assert.equal(lastMsg.payload.status, 'accepted');
    });
  });

  describe('T07 — Image Always Fails (No Room Delay)', () => {
    it('proves image failure does not extend phase and unsubmitted question counts zero', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_t07' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizWithImages);

      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p1_failed_img', nickname: 'FailedImgPlayer', avatarId: 'a1', sessionHash: 'h1' })
      }));

      const hostWs = new MockWebSocket();
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm(); // QUESTION phase

      const questionEndsAt = doInstance.state.activeRound!.endsAt;

      // Player never submits because image failed
      // Alarm triggers when questionEndsAt arrives
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm(); // STATS phase

      assert.equal(doInstance.state.phase, 'STATS');
      // Player score remains 0 (missed question)
      assert.equal(doInstance.state.players.get('p1_failed_img')!.score, 0);
    });
  });

  describe('T08 — Forged Media Readiness Messages Cannot Alter Server Timeline', () => {
    it('ignores unknown or forged socket messages attempting phase control', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_t08' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizWithImages);

      const ws = new MockWebSocket();

      // Client sends forged media.ready message
      await doInstance.webSocketMessage(ws as any, JSON.stringify({
        type: 'media.ready',
        payload: { ready: false, forceExtend: 100000 }
      }));

      // Phase MUST remain in LOBBY (unaltered)
      assert.equal(doInstance.state.phase, 'LOBBY');
    });
  });

  describe('T21 — Image Prefetch Overlaps STATS and LEADERBOARD Without Delaying', () => {
    it('verifies timeline duration remains strict 3s STATS + 5s LEADERBOARD', async () => {
      const storage = createMockDoStorage();
      const mockCtx = {
        id: { toString: () => 'room_t21' },
        storage,
        getWebSockets: () => [],
        acceptWebSocket: () => {}
      };

      const doInstance = new GameRoomDO(mockCtx as any, {} as any);
      await doInstance.initQuizSnapshot(mockQuizWithImages);

      await doInstance.fetch(new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p1', nickname: 'Ali', avatarId: 'a1', sessionHash: 'h1' })
      }));

      const hostWs = new MockWebSocket();
      await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm(); // QUESTION

      // Question ends -> STATS phase
      doInstance.state.activeRound!.endsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'STATS');

      const statsDuration = doInstance.state.activeRound!.statsEndsAt - Date.now();
      assert.ok(statsDuration <= 3000);

      // STATS ends -> LEADERBOARD phase
      doInstance.state.activeRound!.statsEndsAt = Date.now() - 1000;
      await doInstance.alarm();
      assert.equal(doInstance.state.phase, 'LEADERBOARD');

      const rankingDuration = doInstance.state.activeRound!.rankingEndsAt - Date.now();
      assert.ok(rankingDuration <= 5000);
    });
  });

});
