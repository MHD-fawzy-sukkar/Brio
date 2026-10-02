import type { PointsMultiplier } from '@brio/contracts';

export const BASE_POINTS = {
  Standard: 1000,
  Double: 2000,
  Zero: 0
} as const;

/**
 * Correct answers keep at least 50% of their value. The remaining 50% is a
 * smooth speed bonus based on server-observed answer time, so fast answers are
 * rewarded without making a correct late answer feel worthless.
 */
export function calculatePoints(
  isCorrect: boolean,
  multiplier: PointsMultiplier,
  responseTimeMs?: number,
  durationMs?: number
): number {
  if (!isCorrect || multiplier === 'Zero') {
    return 0;
  }
  const base = BASE_POINTS[multiplier as keyof typeof BASE_POINTS] ?? 1000;
  if (responseTimeMs === undefined || durationMs === undefined || durationMs <= 0) return base;

  const elapsedRatio = Math.min(1, Math.max(0, responseTimeMs / durationMs));
  const speedFactor = 1 - elapsedRatio;
  return Math.round(base * (0.5 + speedFactor * 0.5));
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
