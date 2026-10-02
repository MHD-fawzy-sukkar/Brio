import type {
  PlayerSnapshotDto,
  HostSnapshotDto,
  PublicQuestion,
  PublicQuestionOption
} from '@brio/contracts';
import type {
  GameState,
  PublishedQuizSnapshot,
  PublishedQuestion
} from '../engine/types';
import { calculateCompetitionRanks } from '../scoring/rules';

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
export function toPublicQuestion(question: PublishedQuestion): PublicQuestion {
  const publicOptions: PublicQuestionOption[] = question.options.map((opt) => ({
    id: opt.id,
    text: opt.text
  }));

  return {
    id: question.id,
    type: question.type,
    text: question.text,
    durationMs: question.durationMs,
    multiplier: question.multiplier,
    essentialImage: question.essentialImage || null,
    options: publicOptions
  };
}

/**
 * Builds a role-isolated Player Snapshot DTO.
 * Guarantees zero answer key leakage and provides player's own score and top 5 leaderboard.
 */
export function toPublicPlayerSnapshot(
  state: GameState,
  playerId: string,
  quiz: PublishedQuizSnapshot
): PlayerSnapshotDto {
  const player = state.players.get(playerId);
  const ownScore = player ? player.score : 0;

  // Compute competition ranks for all players
  const playerEntries = Array.from(state.players.values()).map((p) => ({
    id: p.id,
    score: p.score,
    joinedAt: p.joinedAt
  }));

  const ranked = calculateCompetitionRanks(playerEntries);
  const me = ranked.find((r) => r.id === playerId);
  const ownRank = me ? me.rank : null;

  // Top 5 players for public leaderboard
  const topPlayers = ranked.slice(0, 5).map((r) => {
    const pState = state.players.get(r.id)!;
    return {
      nickname: pState.nickname,
      avatarId: pState.avatarId,
      score: r.score,
      rank: r.rank
    };
  });
  const lobbyPlayers = Array.from(state.players.values()).map((p) => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId }));

  // Current public question (redacted)
  let publicQuestion: PublicQuestion | null = null;
  if (state.activeRound && state.currentQuestionIndex >= 0 && state.currentQuestionIndex < quiz.questions.length) {
    const rawQ = quiz.questions[state.currentQuestionIndex];
    publicQuestion = toPublicQuestion(rawQ);
  }

  return {
    role: 'player',
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
    lobbyPlayers
  };
}

/**
 * Builds a Host Snapshot DTO with administrative metrics
 */
export function toPublicHostSnapshot(
  state: GameState,
  quiz: PublishedQuizSnapshot
): HostSnapshotDto {
  let publicQuestion: PublicQuestion | null = null;
  if (state.activeRound && state.currentQuestionIndex >= 0 && state.currentQuestionIndex < quiz.questions.length) {
    const rawQ = quiz.questions[state.currentQuestionIndex];
    publicQuestion = toPublicQuestion(rawQ);
  }

  let acceptedAnswersCount = 0;
  if (state.activeRound) {
    const currentRoundId = state.activeRound.roundId;
    for (const ans of state.answers.values()) {
      if (ans.roundId === currentRoundId && ans.status === 'accepted') {
        acceptedAnswersCount++;
      }
    }
  }

  const ranked = calculateCompetitionRanks(Array.from(state.players.values()).map((player) => ({
    id: player.id, score: player.score, joinedAt: player.joinedAt
  })));
  const leaderboard = ranked.slice(0, 10).map((entry) => {
    const player = state.players.get(entry.id)!;
    return { id: player.id, nickname: player.nickname, avatarId: player.avatarId, score: entry.score, rank: entry.rank };
  });

  const answerStats: Array<{ optionId: string | null; label: string; count: number; percentage: number; isCorrect?: boolean }> = [];
  if (state.activeRound && ['STATS', 'LEADERBOARD', 'FINISHED'].includes(state.phase)) {
    const question = quiz.questions[state.currentQuestionIndex];
    const answers = Array.from(state.answers.values()).filter((answer) => answer.roundId === state.activeRound!.roundId && answer.status === 'accepted');
    const denominator = Math.max(1, answers.length);
    if (question.type === 'ShortAnswer') {
      const correct = answers.filter((answer) => answer.isCorrect).length;
      const incorrect = answers.length - correct;
      answerStats.push(
        { optionId: null, label: 'إجابات صحيحة', count: correct, percentage: Math.round(correct / denominator * 100), isCorrect: true },
        { optionId: null, label: 'إجابات أخرى', count: incorrect, percentage: Math.round(incorrect / denominator * 100), isCorrect: false }
      );
    } else {
      for (const option of question.options) {
        const count = answers.filter((answer) => answer.optionId === option.id).length;
        answerStats.push({ optionId: option.id, label: option.text, count, percentage: Math.round(count / denominator * 100), ...(question.type !== 'Poll' ? { isCorrect: option.isCorrect } : {}) });
      }
    }
  }

  return {
    role: 'host',
    roomId: state.roomId,
    code: quiz.roomCode || state.roomId,
    phase: state.phase,
    stateVersion: state.stateVersion,
    roundId: state.activeRound ? state.activeRound.roundId : null,
    questionIndex: state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : null,
    phaseStartedAt: state.activeRound ? state.activeRound.startsAt : 0,
    phaseEndsAt: phaseEndsAt(state),
    playerCount: state.players.size,
    lobbyPlayers: Array.from(state.players.values()).map((p) => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId })),
    acceptedAnswersCount,
    question: publicQuestion,
    answerStats,
    leaderboard
  };
}
