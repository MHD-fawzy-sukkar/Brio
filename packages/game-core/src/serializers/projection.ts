import { toPublicQuestion } from './question';
import type { PublicQuestion } from '@brio/contracts';
import type { GameState, PublishedQuizSnapshot } from '../engine/types';
import { calculateCompetitionRanks } from '../scoring/rules';

/** Ephemeral read model shared by one synchronous fan-out. Never retained across state changes. */
export function createSnapshotProjection(state: GameState, quiz: PublishedQuizSnapshot) {
  const ranked = calculateCompetitionRanks(
    Array.from(state.players.values(), (player) => ({
      id: player.id,
      score: player.score,
      joinedAt: player.joinedAt,
    })),
  );
  const ranks = new Map(ranked.map((entry) => [entry.id, entry.rank]));
  const entries = ranked.map((entry) => {
    const player = state.players.get(entry.id)!;
    return {
      id: player.id,
      nickname: player.nickname,
      avatarId: player.avatarId,
      score: entry.score,
      rank: entry.rank,
    };
  });
  const lobbyPlayers = Array.from(state.players.values(), (player) => ({
    id: player.id,
    nickname: player.nickname,
    avatarId: player.avatarId,
  }));
  const source =
    state.activeRound && state.currentQuestionIndex >= 0 ? quiz.questions[state.currentQuestionIndex] : null;
  const question: PublicQuestion | null = source ? toPublicQuestion(source) : null;

  return {
    ranks,
    lobbyPlayers,
    question,
    leaderboard: entries.slice(0, 10),
    topPlayers: entries.slice(0, 5).map(({ id: _, ...entry }) => entry),
  };
}
export type SnapshotProjection = ReturnType<typeof createSnapshotProjection>;
