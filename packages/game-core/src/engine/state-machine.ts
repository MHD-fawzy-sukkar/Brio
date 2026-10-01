import type {
  GameState,
  PublishedQuizSnapshot,
  PublishedQuestion,
  AnswerSubmissionInput,
  AnswerSubmissionResult,
  EngineEffect,
  ActiveRoundState,
  AnswerRecord
} from './types';
import { calculatePoints } from '../scoring/rules';
import { matchShortAnswer } from '../normalization/matching';

export const COUNTDOWN_DURATION_MS = 3000;
export const STATS_DURATION_MS = 3000;
export const LEADERBOARD_DURATION_MS = 5000;
export const OVERDUE_RECOVERY_THRESHOLD_MS = 5000;

export function createInitialGameState(roomId: string, quizVersionId: string): GameState {
  return {
    roomId,
    quizVersionId,
    phase: 'LOBBY',
    stateVersion: 1,
    currentQuestionIndex: -1,
    activeRound: null,
    players: new Map(),
    answers: new Map(),
    submissionIds: new Set(),
    pausedQueued: false,
    interruptedRoundId: null
  };
}

export function startQuiz(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  now: number
): EngineEffect[] {
  if (state.phase !== 'LOBBY') {
    throw new Error(`Cannot start quiz from phase '${state.phase}'`);
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('Cannot start quiz with 0 questions');
  }

  state.phase = 'COUNTDOWN';
  state.stateVersion++;
  state.currentQuestionIndex = 0;

  const endsAt = now + COUNTDOWN_DURATION_MS;
  state.activeRound = {
    roundId: `round-countdown-${state.currentQuestionIndex}`,
    questionIndex: 0,
    questionId: quiz.questions[0].id,
    type: quiz.questions[0].type,
    startsAt: now,
    endsAt,
    statsEndsAt: 0,
    rankingEndsAt: 0,
    closed: false,
    scored: false
  };

  return [
    { type: 'PERSIST_STATE' },
    { type: 'BROADCAST_STATE' },
    { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' }
  ];
}

export function processAnswerSubmission(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  input: AnswerSubmissionInput,
  now: number
): AnswerSubmissionResult {
  const { playerId, roundId, submissionId, optionId, textAnswer } = input;

  const key = `${roundId}:${playerId}`;
  const existingAnswer = state.answers.get(key);

  // 1. Idempotency Check: Same submissionId and roundId returns existing receipt even after close
  if (existingAnswer) {
    if (existingAnswer.submissionId === submissionId) {
      return {
        status: existingAnswer.status,
        receipt: {
          submissionId,
          roundId,
          status: existingAnswer.status,
          acceptedAt: existingAnswer.receivedAt
        }
      };
    }
    // Conflicting payload or second answer for same round
    return {
      status: 'rejected',
      reason: 'Player has already submitted an answer for this round'
    };
  }

  // 2. Reject duplicate submissionId used across different rounds
  if (state.submissionIds.has(submissionId)) {
    return {
      status: 'rejected',
      reason: 'Duplicate submission ID'
    };
  }

  // 3. Active Round & Phase Validation
  if (state.phase !== 'QUESTION' || !state.activeRound || state.activeRound.roundId !== roundId) {
    return {
      status: 'rejected',
      reason: `Answer submitted outside active question round (Current phase: ${state.phase})`
    };
  }

  // 4. Time Deadline Enforcement: receivedAt MUST be startsAt <= now < endsAt
  // Reject now >= endsAt even if server close alarm is late!
  if (now < state.activeRound.startsAt || now >= state.activeRound.endsAt) {
    return {
      status: 'rejected',
      reason: 'Answer submitted outside question time deadline'
    };
  }

  // 5. Store Accepted Answer Record in Memory (DO NOT score yet!)
  const digest = `${optionId || ''}:${textAnswer || ''}`;
  const record: AnswerRecord = {
    roundId,
    playerId,
    submissionId,
    payloadDigest: digest,
    optionId,
    textAnswer,
    receivedAt: now,
    status: 'accepted'
  };

  state.answers.set(key, record);
  state.submissionIds.add(submissionId);

  return {
    status: 'accepted',
    receipt: {
      submissionId,
      roundId,
      status: 'accepted',
      acceptedAt: now
    }
  };
}

export function scoreRound(
  state: GameState,
  question: PublishedQuestion
): void {
  if (!state.activeRound || state.activeRound.scored) return;

  const roundId = state.activeRound.roundId;

  for (const [key, ans] of state.answers.entries()) {
    if (ans.roundId !== roundId || ans.status !== 'accepted') continue;

    let isCorrect = false;

    if (question.type === 'MultipleChoice' || question.type === 'TrueFalse') {
      const matchOpt = question.options.find((o) => o.id === ans.optionId);
      isCorrect = matchOpt ? matchOpt.isCorrect : false;
    } else if (question.type === 'ShortAnswer') {
      isCorrect = matchShortAnswer(ans.textAnswer || '', question.acceptedAlternatives);
    } else if (question.type === 'Poll') {
      isCorrect = false; // Polls have no correctness
    }

    const points = calculatePoints(isCorrect, question.multiplier);
    ans.isCorrect = isCorrect;
    ans.pointsAwarded = points;

    // Update Player Score
    const player = state.players.get(ans.playerId);
    if (player) {
      player.score += points;
    }
  }

  state.activeRound.scored = true;
}

export function reconcileDeadlines(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  now: number
): EngineEffect[] {
  const effects: EngineEffect[] = [];

  if (!state.activeRound) return effects;

  // Overdue Check (>5 seconds overdue transition -> RECOVERY_PAUSED)
  if (state.phase === 'QUESTION' && now - state.activeRound.endsAt > OVERDUE_RECOVERY_THRESHOLD_MS) {
    state.phase = 'RECOVERY_PAUSED';
    state.interruptedRoundId = state.activeRound.roundId;
    state.stateVersion++;
    return [
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'ENTER_RECOVERY_PAUSED', reason: 'Server scheduled transition overdue by >5 seconds' }
    ];
  }

  // 1. COUNTDOWN -> QUESTION
  if (state.phase === 'COUNTDOWN' && now >= state.activeRound.endsAt) {
    const qIndex = state.currentQuestionIndex;
    const question = quiz.questions[qIndex];

    state.phase = 'QUESTION';
    state.stateVersion++;

    const questionStartsAt = now;
    const questionEndsAt = now + question.durationMs;

    state.activeRound = {
      roundId: `round-${qIndex}-${question.id}`,
      questionIndex: qIndex,
      questionId: question.id,
      type: question.type,
      startsAt: questionStartsAt,
      endsAt: questionEndsAt,
      statsEndsAt: questionEndsAt + STATS_DURATION_MS,
      rankingEndsAt: questionEndsAt + STATS_DURATION_MS + LEADERBOARD_DURATION_MS,
      closed: false,
      scored: false
    };

    effects.push(
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' }
    );
    return effects;
  }

  // 2. QUESTION -> STATS
  if (state.phase === 'QUESTION' && now >= state.activeRound.endsAt) {
    state.phase = 'STATS';
    state.stateVersion++;
    state.activeRound.closed = true;

    const question = quiz.questions[state.currentQuestionIndex];
    scoreRound(state, question);

    const statsEndsAt = now + STATS_DURATION_MS;
    state.activeRound.statsEndsAt = statsEndsAt;

    effects.push(
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: statsEndsAt, actionName: 'reconcile_deadlines' }
    );
    return effects;
  }

  // 3. STATS -> LEADERBOARD
  if (state.phase === 'STATS' && now >= state.activeRound.statsEndsAt) {
    state.phase = 'LEADERBOARD';
    state.stateVersion++;

    const rankingEndsAt = now + LEADERBOARD_DURATION_MS;
    state.activeRound.rankingEndsAt = rankingEndsAt;

    effects.push(
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: rankingEndsAt, actionName: 'reconcile_deadlines' }
    );
    return effects;
  }

  // 4. LEADERBOARD -> NEXT QUESTION / PAUSED / FINISHED
  if (state.phase === 'LEADERBOARD' && now >= state.activeRound.rankingEndsAt) {
    if (state.pausedQueued) {
      state.phase = 'PAUSED';
      state.pausedQueued = false;
      state.stateVersion++;
      effects.push({ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' });
      return effects;
    }

    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex < quiz.questions.length) {
      state.currentQuestionIndex = nextIndex;
      const nextQuestion = quiz.questions[nextIndex];

      state.phase = 'QUESTION';
      state.stateVersion++;

      const questionStartsAt = now;
      const questionEndsAt = now + nextQuestion.durationMs;

      state.activeRound = {
        roundId: `round-${nextIndex}-${nextQuestion.id}`,
        questionIndex: nextIndex,
        questionId: nextQuestion.id,
        type: nextQuestion.type,
        startsAt: questionStartsAt,
        endsAt: questionEndsAt,
        statsEndsAt: questionEndsAt + STATS_DURATION_MS,
        rankingEndsAt: questionEndsAt + STATS_DURATION_MS + LEADERBOARD_DURATION_MS,
        closed: false,
        scored: false
      };

      effects.push(
        { type: 'PERSIST_STATE' },
        { type: 'BROADCAST_STATE' },
        { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' }
      );
    } else {
      state.phase = 'FINISHED';
      state.stateVersion++;
      effects.push({ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' });
    }
    return effects;
  }

  return effects;
}

export function requestPause(state: GameState): EngineEffect[] {
  if (state.phase === 'QUESTION') {
    state.pausedQueued = true;
    return [{ type: 'PERSIST_STATE' }];
  }

  state.phase = 'PAUSED';
  state.stateVersion++;
  return [{ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' }];
}

export function requestResume(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  now: number
): EngineEffect[] {
  if (state.phase !== 'PAUSED') {
    return [];
  }

  const nextIndex = state.currentQuestionIndex + 1 < quiz.questions.length ? state.currentQuestionIndex + 1 : state.currentQuestionIndex;
  state.currentQuestionIndex = nextIndex;
  const question = quiz.questions[nextIndex];

  state.phase = 'QUESTION';
  state.stateVersion++;

  const questionEndsAt = now + question.durationMs;
  state.activeRound = {
    roundId: `round-resumed-${nextIndex}-${question.id}`,
    questionIndex: nextIndex,
    questionId: question.id,
    type: question.type,
    startsAt: now,
    endsAt: questionEndsAt,
    statsEndsAt: questionEndsAt + STATS_DURATION_MS,
    rankingEndsAt: questionEndsAt + STATS_DURATION_MS + LEADERBOARD_DURATION_MS,
    closed: false,
    scored: false
  };

  return [
    { type: 'PERSIST_STATE' },
    { type: 'BROADCAST_STATE' },
    { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' }
  ];
}

export function handleOverdueRecovery(
  state: GameState,
  action: 'void_and_replay' | 'void_and_skip',
  quiz: PublishedQuizSnapshot,
  now: number
): EngineEffect[] {
  if (state.phase !== 'RECOVERY_PAUSED') {
    throw new Error('Recovery action can only be executed in RECOVERY_PAUSED state');
  }

  const qIndex = state.currentQuestionIndex;
  const question = quiz.questions[qIndex];

  if (action === 'void_and_replay') {
    // Reverse score awards for interrupted round
    if (state.interruptedRoundId) {
      for (const ans of state.answers.values()) {
        if (ans.roundId === state.interruptedRoundId && ans.pointsAwarded && ans.pointsAwarded > 0) {
          const player = state.players.get(ans.playerId);
          if (player) {
            player.score -= ans.pointsAwarded;
          }
          ans.pointsAwarded = 0;
        }
      }
    }

    state.phase = 'QUESTION';
    state.stateVersion++;
    const endsAt = now + question.durationMs;

    state.activeRound = {
      roundId: `round-replayed-${qIndex}-${question.id}-${Date.now()}`,
      questionIndex: qIndex,
      questionId: question.id,
      type: question.type,
      startsAt: now,
      endsAt,
      statsEndsAt: endsAt + STATS_DURATION_MS,
      rankingEndsAt: endsAt + STATS_DURATION_MS + LEADERBOARD_DURATION_MS,
      closed: false,
      scored: false
    };

    return [
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' }
    ];
  } else {
    // Void and skip: skip to next question or finish
    const nextIndex = qIndex + 1;
    if (nextIndex < quiz.questions.length) {
      state.currentQuestionIndex = nextIndex;
      const nextQ = quiz.questions[nextIndex];

      state.phase = 'QUESTION';
      state.stateVersion++;
      const endsAt = now + nextQ.durationMs;

      state.activeRound = {
        roundId: `round-${nextIndex}-${nextQ.id}`,
        questionIndex: nextIndex,
        questionId: nextQ.id,
        type: nextQ.type,
        startsAt: now,
        endsAt,
        statsEndsAt: endsAt + STATS_DURATION_MS,
        rankingEndsAt: endsAt + STATS_DURATION_MS + LEADERBOARD_DURATION_MS,
        closed: false,
        scored: false
      };

      return [
        { type: 'PERSIST_STATE' },
        { type: 'BROADCAST_STATE' },
        { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' }
      ];
    } else {
      state.phase = 'FINISHED';
      state.stateVersion++;
      return [{ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' }];
    }
  }
}
