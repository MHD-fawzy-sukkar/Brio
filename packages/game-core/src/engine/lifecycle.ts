import type { GameState, PublishedQuizSnapshot, EngineEffect } from './types';
import { COUNTDOWN_DURATION_MS } from './durations';

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
    interruptedRoundId: null,
  };
}

export function startQuiz(state: GameState, quiz: PublishedQuizSnapshot, now: number): EngineEffect[] {
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
    scored: false,
  };

  return [
    { type: 'PERSIST_STATE' },
    { type: 'BROADCAST_STATE' },
    { type: 'SCHEDULE_ALARM', dueAt: endsAt, actionName: 'reconcile_deadlines' },
  ];
}

export function endQuiz(state: GameState): EngineEffect[] {
  if (state.phase === 'FINISHED') return [];
  state.phase = 'FINISHED';
  state.stateVersion++;
  if (state.activeRound) state.activeRound.closed = true;
  return [{ type: 'PERSIST_STATE' }, { type: 'BROADCAST_STATE' }, { type: 'CANCEL_ALARM' }];
}
