import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicPlayerSnapshot, toPublicHostSnapshot } from '@brio/game-core';
import { mockQuizSnapshot } from './testing-fixtures';
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
        scored: false,
      },
      players: new Map([
        [
          'p_1',
          {
            id: 'p_1',
            nickname: 'Sara',
            avatarId: 'a1',
            score: 100,
            joinedAt: Date.now(),
            connectionGeneration: 1,
          },
        ],
      ]),
      answers: new Map(),
      submissionIds: new Set<string>(),
      pausedQueued: false,
      interruptedRoundId: null,
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
