import type { PlayerSnapshotDto, HostSnapshotDto } from '@brio/contracts';
import type { GameState, PublishedQuizSnapshot } from '../engine/types';
import { createSnapshotProjection, type SnapshotProjection } from './projection';
export { createSnapshotProjection } from './projection';

function phaseEndsAt(state: GameState): number {
  if (!state.activeRound) return 0;
  if (state.phase === 'STATS') return state.activeRound.statsEndsAt;
  if (state.phase === 'LEADERBOARD') return state.activeRound.rankingEndsAt;
  return state.activeRound.endsAt;
}

/**
 * Serializes a published question for public player/host consumption.
 * ABSOLUTELY REDACTS all `isCorrect` flags and accepted alternatives!
 */
export { toPublicQuestion } from './question';

/**
 * Builds a role-isolated Player Snapshot DTO.
 * Guarantees zero answer key leakage and provides player's own score and top 5 leaderboard.
 */
export function toPublicPlayerSnapshot(
  state: GameState,
  playerId: string,
  quiz: PublishedQuizSnapshot,
  projection: SnapshotProjection = createSnapshotProjection(state, quiz),
): PlayerSnapshotDto {
  const player = state.players.get(playerId);
  const ownScore = player ? player.score : 0;

  const ownRank = projection.ranks.get(playerId) ?? null;
  const { question: publicQuestion, topPlayers, lobbyPlayers } = projection;

  return {
    role: 'player',
    identity: quiz.identity,
    roomId: state.roomId,
    phase: state.phase,
    stateVersion: state.stateVersion,
    roundId: state.activeRound ? state.activeRound.roundId : null,
    questionIndex: state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : null,
    phaseStartedAt: state.activeRound ? state.activeRound.startsAt : 0,
    phaseEndsAt: phaseEndsAt(state),
    question: publicQuestion,
    ownScore,
    ownRank,
    topPlayers,
    lobbyPlayers,
  };
}

/**
 * Builds a Host Snapshot DTO with administrative metrics
 */
export function toPublicHostSnapshot(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  projection: SnapshotProjection = createSnapshotProjection(state, quiz),
): HostSnapshotDto {
  const { question: publicQuestion, leaderboard, lobbyPlayers } = projection;

  let acceptedAnswersCount = 0;
  if (state.activeRound) {
    const currentRoundId = state.activeRound.roundId;
    for (const ans of state.answers.values()) {
      if (ans.roundId === currentRoundId && ans.status === 'accepted') {
        acceptedAnswersCount++;
      }
    }
  }

  const answerStats: Array<{
    optionId: string | null;
    label: string;
    count: number;
    percentage: number;
    isCorrect?: boolean;
  }> = [];
  if (state.activeRound && ['STATS', 'LEADERBOARD', 'FINISHED'].includes(state.phase)) {
    const question = quiz.questions[state.currentQuestionIndex];
    const answers = Array.from(state.answers.values()).filter(
      (answer) => answer.roundId === state.activeRound!.roundId && answer.status === 'accepted',
    );
    const denominator = Math.max(1, answers.length);
    if (question.type === 'ShortAnswer') {
      const correct = answers.filter((answer) => answer.isCorrect).length;
      const incorrect = answers.length - correct;
      answerStats.push(
        {
          optionId: null,
          label: 'إجابات صحيحة',
          count: correct,
          percentage: Math.round((correct / denominator) * 100),
          isCorrect: true,
        },
        {
          optionId: null,
          label: 'إجابات أخرى',
          count: incorrect,
          percentage: Math.round((incorrect / denominator) * 100),
          isCorrect: false,
        },
      );
    } else {
      for (const option of question.options) {
        const count = answers.filter((answer) => answer.optionId === option.id).length;
        answerStats.push({
          optionId: option.id,
          label: option.text,
          count,
          percentage: Math.round((count / denominator) * 100),
          ...(question.type !== 'Poll' ? { isCorrect: option.isCorrect } : {}),
        });
      }
    }
  }

  return {
    role: 'host',
    identity: quiz.identity,
    quizTitle: quiz.title,
    roomId: state.roomId,
    code: quiz.roomCode || state.roomId,
    phase: state.phase,
    stateVersion: state.stateVersion,
    roundId: state.activeRound ? state.activeRound.roundId : null,
    questionIndex: state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : null,
    phaseStartedAt: state.activeRound ? state.activeRound.startsAt : 0,
    phaseEndsAt: phaseEndsAt(state),
    playerCount: state.players.size,
    lobbyPlayers,
    acceptedAnswersCount,
    question: publicQuestion,
    answerStats,
    leaderboard,
  };
}
