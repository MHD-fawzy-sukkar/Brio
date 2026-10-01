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
    phaseEndsAt: state.activeRound ? state.activeRound.endsAt : 0,
    question: publicQuestion,
    ownScore,
    ownRank,
    topPlayers
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

  return {
    role: 'host',
    roomId: state.roomId,
    code: state.roomId,
    phase: state.phase,
    stateVersion: state.stateVersion,
    roundId: state.activeRound ? state.activeRound.roundId : null,
    questionIndex: state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : null,
    phaseStartedAt: state.activeRound ? state.activeRound.startsAt : 0,
    phaseEndsAt: state.activeRound ? state.activeRound.endsAt : 0,
    playerCount: state.players.size,
    acceptedAnswersCount,
    question: publicQuestion
  };
}
