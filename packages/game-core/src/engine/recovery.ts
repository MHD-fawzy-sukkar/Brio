import type { GameState, PublishedQuizSnapshot, EngineEffect } from './types';
import { STATS_DURATION_MS } from './durations';
import { LEADERBOARD_DURATION_MS } from './durations';

export function requestPause(state: GameState): EngineEffect[] {
  if (state.phase === 'QUESTION') {
    state.pausedQueued = true;
    return [{ type: 'PERSIST_STATE' }];
  }

  state.phase = 'PAUSED';
  state.stateVersion++;
  return [{ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' }];
}

export function requestResume(state: GameState, quiz: PublishedQuizSnapshot, now: number): EngineEffect[] {
  if (state.phase !== 'PAUSED') {
    return [];
  }

  const nextIndex =
    state.currentQuestionIndex + 1 < quiz.questions.length
      ? state.currentQuestionIndex + 1
      : state.currentQuestionIndex;
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
    scored: false,
  };

  return [
    { type: 'PERSIST_STATE' },
    { type: 'BROADCAST_STATE' },
    { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' },
  ];
}

export function handleOverdueRecovery(
  state: GameState,
  action: 'void_and_replay' | 'void_and_skip',
  quiz: PublishedQuizSnapshot,
  now: number,
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
      scored: false,
    };

    return [
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' },
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
        scored: false,
      };

      return [
        { type: 'PERSIST_STATE' },
        { type: 'BROADCAST_STATE' },
        { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' },
      ];
    } else {
      state.phase = 'FINISHED';
      state.stateVersion++;
      return [{ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' }];
    }
  }
}
