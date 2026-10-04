import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  startQuiz,
  processAnswerSubmission,
  reconcileDeadlines,
  requestPause,
  requestResume,
  handleOverdueRecovery,
  endQuiz
} from './state-machine';
import {
  toPublicPlayerSnapshot,
  toPublicHostSnapshot,
  toPublicQuestion
} from '../serializers/public';
import type { PublishedQuizSnapshot } from './types';

const SAMPLE_QUIZ: PublishedQuizSnapshot = {
  id: 'quiz-1',
  title: 'اختبار المسابقة الثقافية',
  revision: 1,
  questions: [
    {
      id: 'q1',
      type: 'MultipleChoice',
      text: 'ما هي عاصمة المملكة العربية السعودية؟',
      durationMs: 20000,
      multiplier: 'Standard',
      options: [
        { id: 'o1', text: 'الرياض', isCorrect: true },
        { id: 'o2', text: 'جدة', isCorrect: false },
        { id: 'o3', text: 'مكة', isCorrect: false },
        { id: 'o4', text: 'الدمام', isCorrect: false }
      ],
      acceptedAlternatives: []
    },
    {
      id: 'q2',
      type: 'Poll',
      text: 'ما هو لوناك المفضل؟',
      durationMs: 15000,
      multiplier: 'Zero',
      options: [
        { id: 'p1', text: 'أزرق', isCorrect: false },
        { id: 'p2', text: 'أحمر', isCorrect: false }
      ],
      acceptedAlternatives: []
    },
    {
      id: 'q3',
      type: 'ShortAnswer',
      text: 'اكتب عاصمة المملكة',
      durationMs: 20000,
      multiplier: 'Double',
      options: [],
      acceptedAlternatives: ['الرياض', 'مدينة الرياض']
    }
  ]
};

test('Host end transitions any active room to FINISHED and cancels its alarm idempotently', () => {
  const state = createInitialGameState('room-end', SAMPLE_QUIZ.id);
  startQuiz(state, SAMPLE_QUIZ, 1_000);
  const effects = endQuiz(state);
  assert.equal(state.phase, 'FINISHED');
  assert.equal(state.activeRound?.closed, true);
  assert.ok(effects.some((effect) => effect.type === 'CANCEL_ALARM'));
  assert.deepEqual(endQuiz(state), []);
});

test('Full State Machine Workflow skips the intermediate leaderboard after the final question', () => {
  let now = 1000000;
  const state = createInitialGameState('room-1', 'version-1');

  // Add 3 players
  state.players.set('p1', { id: 'p1', nickname: 'أحمد', avatarId: 'av1', score: 0, joinedAt: 100, connectionGeneration: 1 });
  state.players.set('p2', { id: 'p2', nickname: 'سارة', avatarId: 'av2', score: 0, joinedAt: 150, connectionGeneration: 1 });
  state.players.set('p3', { id: 'p3', nickname: 'خالد', avatarId: 'av3', score: 0, joinedAt: 200, connectionGeneration: 1 });

  // 1. Start Quiz -> COUNTDOWN
  const startEffects = startQuiz(state, SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'COUNTDOWN');
  assert.equal(state.activeRound?.endsAt, now + 3000);

  // Advance time to COUNTDOWN endsAt
  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);

  // 2. Transferred to QUESTION 1 (MultipleChoice)
  assert.equal(state.phase, 'QUESTION');
  assert.equal(state.currentQuestionIndex, 0);
  const roundId1 = state.activeRound!.roundId;

  // Submit correct answer for p1, wrong answer for p2, p3 misses
  const subP1 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1',
    roundId: roundId1,
    submissionId: 'sub-1',
    optionId: 'o1'
  }, now + 1000);
  assert.equal(subP1.status, 'accepted');

  const subP2 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p2',
    roundId: roundId1,
    submissionId: 'sub-2',
    optionId: 'o2'
  }, now + 2000);
  assert.equal(subP2.status, 'accepted');
  assert.equal(toPublicHostSnapshot(state,SAMPLE_QUIZ).acceptedAnswersCount,2);

  // Advance time to Question 1 endsAt
  now += 20000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);

  // 3. Transferred to STATS phase & Scored
  assert.equal(state.phase, 'STATS');
  assert.equal(state.players.get('p1')?.score, 975); // Correct in 1s of a 20s round
  assert.equal(state.players.get('p2')?.score, 0);    // Wrong = 0 pts
  assert.equal(state.players.get('p3')?.score, 0);    // Missed = 0 pts
  const statsSnapshot = toPublicHostSnapshot(state, SAMPLE_QUIZ);
  assert.equal(statsSnapshot.phaseEndsAt, state.activeRound!.statsEndsAt);
  assert.equal(statsSnapshot.answerStats.find((item) => item.optionId === 'o1')?.count, 1);
  assert.equal(statsSnapshot.answerStats.find((item) => item.optionId === 'o1')?.isCorrect, true);
  assert.equal(statsSnapshot.leaderboard[0].score, 975);

  // Advance to LEADERBOARD
  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'LEADERBOARD');

  // Advance to Question 2 (Poll)
  now += 5000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'QUESTION');
  assert.equal(state.currentQuestionIndex, 1);
  const roundId2 = state.activeRound!.roundId;

  // Submit Poll answer for p1
  processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1',
    roundId: roundId2,
    submissionId: 'sub-3',
    optionId: 'p1'
  }, now + 500);

  // Advance through STATS and LEADERBOARD for Question 2
  now += 15000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // STATS
  assert.equal(state.players.get('p1')?.score, 975); // Poll gives 0 points

  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // LEADERBOARD

  // Advance to Question 3 (ShortAnswer - Double multiplier)
  now += 5000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'QUESTION');
  assert.equal(state.currentQuestionIndex, 2);
  const roundId3 = state.activeRound!.roundId;

  // Submit ShortAnswer for p2 (Double multiplier = 2000 pts)
  processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p2',
    roundId: roundId3,
    submissionId: 'sub-4',
    textAnswer: 'الرياض'
  }, now + 1000);

  now += 20000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // STATS
  assert.equal(state.players.get('p2')?.score, 1950); // Fast correct answer earns a speed-adjusted double score
  assert.equal(state.players.get('p1')?.score, 975); // Prefix sum preserves earlier rounds

  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'FINISHED');
});

test('Answer Time Deadline Enforcement: receivedAt startsAt <= now < endsAt', () => {
  let now = 1000000;
  const state = createInitialGameState('room-1', 'version-1');
  state.players.set('p1', { id: 'p1', nickname: 'أحمد', avatarId: 'av1', score: 0, joinedAt: 100, connectionGeneration: 1 });

  startQuiz(state, SAMPLE_QUIZ, now);
  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // Now in QUESTION 1 (startsAt = 1003000, endsAt = 1023000)

  const roundId = state.activeRound!.roundId;
  const endsAt = state.activeRound!.endsAt;

  // Accepted exactly at startsAt
  const res1 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1', roundId, submissionId: 'sub-a', optionId: 'o1'
  }, state.activeRound!.startsAt);
  assert.equal(res1.status, 'accepted');

  // Rejected when now >= endsAt (even if close alarm hasn't run!)
  state.answers.clear();
  const res2 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1', roundId, submissionId: 'sub-b', optionId: 'o1'
  }, endsAt);
  assert.equal(res2.status, 'rejected');
  assert.equal(res2.reason, 'Answer submitted outside question time deadline');
});

test('Answer Idempotency: Duplicate submissionId returns saved receipt even after close', () => {
  let now = 1000000;
  const state = createInitialGameState('room-1', 'version-1');
  state.players.set('p1', { id: 'p1', nickname: 'أحمد', avatarId: 'av1', score: 0, joinedAt: 100, connectionGeneration: 1 });

  startQuiz(state, SAMPLE_QUIZ, now);
  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now);
  const roundId = state.activeRound!.roundId;

  // First submission
  const sub1 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1', roundId, submissionId: 'sub-idem-1', optionId: 'o1'
  }, now + 1000);
  assert.equal(sub1.status, 'accepted');

  // Duplicate submissionId during active question
  const sub2 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1', roundId, submissionId: 'sub-idem-1', optionId: 'o1'
  }, now + 2000);
  assert.equal(sub2.status, 'accepted');

  // Close round
  now += 20000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // STATS

  // Retry after close returns saved receipt without double scoring!
  const sub3 = processAnswerSubmission(state, SAMPLE_QUIZ, {
    playerId: 'p1', roundId, submissionId: 'sub-idem-1', optionId: 'o1'
  }, now + 5000);
  assert.equal(sub3.status, 'accepted');
  assert.equal(state.players.get('p1')?.score, 975); // Score remains unchanged, not awarded twice
});

test('Overdue Server Transition (>5s) Triggers RECOVERY_PAUSED and Supports void_and_replay', () => {
  let now = 1000000;
  const state = createInitialGameState('room-1', 'version-1');
  state.players.set('p1', { id: 'p1', nickname: 'أحمد', avatarId: 'av1', score: 0, joinedAt: 100, connectionGeneration: 1 });

  startQuiz(state, SAMPLE_QUIZ, now);
  now += 3000;
  reconcileDeadlines(state, SAMPLE_QUIZ, now); // QUESTION 1
  const roundId = state.activeRound!.roundId;

  // Overdue by 6 seconds (> 5000ms threshold)
  now += 20000 + 6000;
  const effects = reconcileDeadlines(state, SAMPLE_QUIZ, now);

  assert.equal(state.phase, 'RECOVERY_PAUSED');
  assert.equal(effects.some((e) => e.type === 'ENTER_RECOVERY_PAUSED'), true);

  // Execute recovery action void_and_replay
  handleOverdueRecovery(state, 'void_and_replay', SAMPLE_QUIZ, now);
  assert.equal(state.phase, 'QUESTION');
  assert.notEqual(state.activeRound!.roundId, roundId); // New roundId created
});

test('Public Serializers Redact Answer Keys and Accepted Alternatives', () => {
  const publicQ = toPublicQuestion(SAMPLE_QUIZ.questions[0]);
  assert.equal('isCorrect' in publicQ.options![0], false);
  assert.equal('acceptedAlternatives' in publicQ, false);

  const state = createInitialGameState('room-1', 'version-1');
  state.players.set('p1', { id: 'p1', nickname: 'أحمد', avatarId: 'av1', score: 1000, joinedAt: 100, connectionGeneration: 1 });

  const playerSnapshot = toPublicPlayerSnapshot(state, 'p1', SAMPLE_QUIZ);
  assert.equal(playerSnapshot.role, 'player');
  assert.equal(playerSnapshot.ownScore, 1000);
  assert.equal(playerSnapshot.lobbyPlayers.length, 1);

  const hostSnapshot = toPublicHostSnapshot(state, SAMPLE_QUIZ);
  assert.equal(hostSnapshot.role, 'host');
  assert.equal(hostSnapshot.quizTitle, SAMPLE_QUIZ.title);
  assert.equal(hostSnapshot.playerCount, 1);
  assert.equal(hostSnapshot.lobbyPlayers[0].nickname, 'أحمد');
});
