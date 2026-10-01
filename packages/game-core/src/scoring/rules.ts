import type { PointsMultiplier } from '@brio/contracts';

export const BASE_POINTS = {
  Standard: 1000,
  Double: 2000,
  Zero: 0
} as const;

/**
 * Calculates awarded points based on correctness and multiplier.
 * No speed component in MVP (per SRS-Architecture.md Section 3).
 */
export function calculatePoints(isCorrect: boolean, multiplier: PointsMultiplier): number {
  if (!isCorrect || multiplier === 'Zero') {
    return 0;
  }
  return BASE_POINTS[multiplier as keyof typeof BASE_POINTS] ?? 1000;
}

export interface PlayerScoreEntry {
  id: string;
  score: number;
  joinedAt: number;
}

export interface RankedPlayerEntry extends PlayerScoreEntry {
  rank: number;
}

/**
 * Calculates competition ranks for players.
 * Ties share competition rank (1, 1, 3).
 * Within a tie, join order (joinedAt asc) is used for stable display array ordering only,
 * never modifying the official rank value.
 */
export function calculateCompetitionRanks(players: PlayerScoreEntry[]): RankedPlayerEntry[] {
  // Sort by score desc, then joinedAt asc for stable display
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt - b.joinedAt;
  });

  const result: RankedPlayerEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1;
    }
    result.push({
      ...sorted[i],
      rank: currentRank
    });
  }

  return result;
}
