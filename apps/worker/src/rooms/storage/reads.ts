import type {
  GameState,
  PublishedQuizSnapshot,
  PlayerState,
  ActiveRoundState,
  AnswerRecord,
} from '@brio/game-core';
import type { SqlStorageLike } from './types';
import { initRoomDbSchema } from './schema';

export function loadQuizSnapshotFromDb(sql: SqlStorageLike): PublishedQuizSnapshot | null {
  const cursor = sql.exec('SELECT json_data FROM quiz_snapshot LIMIT 1');
  const rows = Array.from(cursor);
  if (rows.length === 0) return null;
  const row = rows[0] as any;
  return JSON.parse(row.json_data || row[0]);
}

export function loadGameStateFromDb(sql: SqlStorageLike, roomId: string, quizVersionId: string): GameState {
  initRoomDbSchema(sql);

  // Load Meta
  const metaRows = Array.from(sql.exec('SELECT key, value FROM room_meta'));
  const metaMap = new Map<string, string>();
  for (const r of metaRows as any[]) {
    metaMap.set(r.key || r[0], r.value || r[1]);
  }

  const phase = (metaMap.get('phase') || 'LOBBY') as any;
  const stateVersion = parseInt(metaMap.get('stateVersion') || '1', 10);
  const currentQuestionIndex = parseInt(metaMap.get('currentQuestionIndex') || '-1', 10);
  const pausedQueued = metaMap.get('pausedQueued') === 'true';

  // Load Players
  const playerRows = Array.from(
    sql.exec('SELECT player_id, nickname, avatar, joined_at, score, connection_generation FROM players'),
  );
  const players = new Map<string, PlayerState>();
  for (const r of playerRows as any[]) {
    const p: PlayerState = {
      id: r.player_id || r[0],
      nickname: r.nickname || r[1],
      avatarId: r.avatar || r[2],
      joinedAt: typeof r.joined_at === 'number' ? r.joined_at : parseInt(r[3], 10),
      score: typeof r.score === 'number' ? r.score : parseInt(r[4], 10),
      connectionGeneration:
        typeof r.connection_generation === 'number' ? r.connection_generation : parseInt(r[5], 10),
    };
    players.set(p.id, p);
  }

  // Load Active Round
  const roundRows = Array.from(
    sql.exec(
      'SELECT round_id, question_index, question_id, type, starts_at, ends_at, stats_ends_at, ranking_ends_at, closed, scored FROM rounds ORDER BY starts_at DESC LIMIT 1',
    ),
  );
  let activeRound: ActiveRoundState | null = null;
  if (roundRows.length > 0) {
    const r = roundRows[0] as any;
    activeRound = {
      roundId: r.round_id || r[0],
      questionIndex: typeof r.question_index === 'number' ? r.question_index : parseInt(r[1], 10),
      questionId: r.question_id || r[2],
      type: r.type || r[3],
      startsAt: typeof r.starts_at === 'number' ? r.starts_at : parseInt(r[4], 10),
      endsAt: typeof r.ends_at === 'number' ? r.ends_at : parseInt(r[5], 10),
      statsEndsAt: typeof r.stats_ends_at === 'number' ? r.stats_ends_at : parseInt(r[6], 10),
      rankingEndsAt: typeof r.ranking_ends_at === 'number' ? r.ranking_ends_at : parseInt(r[7], 10),
      closed: (r.closed || r[8]) === 1,
      scored: (r.scored || r[9]) === 1,
    };
  }

  // Load Answers
  const answerRows = Array.from(
    sql.exec(
      'SELECT round_id, player_id, submission_id, payload_digest, option_id, text_answer, received_at, status, is_correct, points_awarded FROM answers',
    ),
  );
  const answers = new Map<string, AnswerRecord>();
  const submissionIds = new Set<string>();

  for (const r of answerRows as any[]) {
    const ans: AnswerRecord = {
      roundId: r.round_id || r[0],
      playerId: r.player_id || r[1],
      submissionId: r.submission_id || r[2],
      payloadDigest: r.payload_digest || r[3],
      optionId: r.option_id || r[4] || undefined,
      textAnswer: r.text_answer || r[5] || undefined,
      receivedAt: typeof r.received_at === 'number' ? r.received_at : parseInt(r[6], 10),
      status: r.status || r[7],
      isCorrect: (r.is_correct || r[8]) !== null ? (r.is_correct || r[8]) === 1 : undefined,
      pointsAwarded: (r.points_awarded || r[9]) !== null ? r.points_awarded || r[9] : undefined,
    };
    answers.set(`${ans.roundId}:${ans.playerId}`, ans);
    submissionIds.add(ans.submissionId);
  }

  return {
    roomId: metaMap.get('roomId') || roomId,
    quizVersionId,
    phase,
    stateVersion,
    currentQuestionIndex,
    activeRound,
    players,
    answers,
    submissionIds,
    pausedQueued,
    interruptedRoundId: null,
  };
}

export function countRoomParticipations(sql: SqlStorageLike): number {
  const row = Array.from(sql.exec('SELECT COUNT(*) AS total FROM participation_history'))[0] as {
    total: number;
  };
  return Number(row?.total ?? 0);
}
