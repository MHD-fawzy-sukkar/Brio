import type { GameState, PublishedQuizSnapshot, EngineEffect } from './types';
import { STATS_DURATION_MS } from './durations';
import { LEADERBOARD_DURATION_MS } from './durations';
import { OVERDUE_RECOVERY_THRESHOLD_MS } from './durations';
import { scoreRound } from './answers';

export function reconcileDeadlines(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  now: number,
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
      { type: 'ENTER_RECOVERY_PAUSED', reason: 'Server scheduled transition overdue by >5 seconds' },
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
      scored: false,
    };

    effects.push(
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' },
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
      { type: 'PERSIST_SCORES' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: statsEndsAt, actionName: 'reconcile_deadlines' },
    );
    return effects;
  }

  // 3. STATS -> LEADERBOARD
  if (state.phase === 'STATS' && now >= state.activeRound.statsEndsAt) {
    if (state.currentQuestionIndex >= quiz.questions.length - 1) {
      state.phase = 'FINISHED';
      state.stateVersion++;
      effects.push({ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' });
      return effects;
    }

    state.phase = 'LEADERBOARD';
    state.stateVersion++;

    const rankingEndsAt = now + LEADERBOARD_DURATION_MS;
    state.activeRound.rankingEndsAt = rankingEndsAt;

    effects.push(
      { type: 'PERSIST_STATE' },
      { type: 'BROADCAST_STATE' },
      { type: 'SCHEDULE_ALARM', dueAt: rankingEndsAt, actionName: 'reconcile_deadlines' },
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
        scored: false,
      };

      effects.push(
        { type: 'PERSIST_STATE' },
        { type: 'BROADCAST_STATE' },
        { type: 'SCHEDULE_ALARM', dueAt: questionEndsAt, actionName: 'reconcile_deadlines' },
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
