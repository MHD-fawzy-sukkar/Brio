import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialGameState,
  startQuiz,
  reconcileDeadlines,
  processAnswerSubmission,
} from '../engine/state-machine';
import type { PublishedQuizSnapshot } from '../engine/types';
import { createSnapshotProjection, toPublicHostSnapshot, toPublicPlayerSnapshot } from './public';

test('shared projections preserve role isolation and fresh scores across every room phase', () => {
  const question = {
    id: 'q1',
    type: 'MultipleChoice' as const,
    text: 'Choose',
    durationMs: 10000,
    multiplier: 'Standard' as const,
    options: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: false },
    ],
    acceptedAlternatives: [],
  };
  const quiz: PublishedQuizSnapshot = {
    id: 'version',
    revision: 1,
    title: 'Projection',
    questions: [question, { ...question, id: 'q2' }],
  };
  const state = createInitialGameState('room', quiz.id);
  for (let i = 0; i < 150; i++)
    state.players.set(`p${i}`, {
      id: `p${i}`,
      nickname: `Player ${i}`,
      avatarId: 'avatar_1',
      score: 0,
      joinedAt: i,
      connectionGeneration: 1,
    });
  const check = () => {
    const projection = createSnapshotProjection(state, quiz);
    assert.deepEqual(toPublicHostSnapshot(state, quiz, projection), toPublicHostSnapshot(state, quiz));
    for (const player of state.players.keys()) {
      const snapshot = toPublicPlayerSnapshot(state, player, quiz, projection);
      assert.deepEqual(snapshot, toPublicPlayerSnapshot(state, player, quiz));
      assert.equal(JSON.stringify(snapshot).includes('isCorrect'), false);
      assert.equal('answerStats' in snapshot, false);
    }
  };
  check();
  startQuiz(state, quiz, 1000);
  check();
  reconcileDeadlines(state, quiz, 4000);
  check();
  processAnswerSubmission(
    state,
    quiz,
    { playerId: 'p1', roundId: state.activeRound!.roundId, submissionId: 's', optionId: 'a' },
    4100,
  );
  for (const now of [14000, 17000, 22000, 32000, 35000]) {
    reconcileDeadlines(state, quiz, now);
    check();
  }
  assert.equal(state.phase, 'FINISHED');
  assert.ok(state.players.get('p1')!.score > 0);
});
