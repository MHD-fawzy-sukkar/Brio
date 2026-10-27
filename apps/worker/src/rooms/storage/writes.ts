import type {
  GameState,
  PublishedQuizSnapshot,
  PlayerState,
  ActiveRoundState,
  AnswerRecord,
} from '@brio/game-core';
import type { SqlStorageLike } from './types';

export function saveQuizSnapshotToDb(sql: SqlStorageLike, quiz: PublishedQuizSnapshot): void {
  sql.exec(
    'INSERT OR REPLACE INTO quiz_snapshot (id, json_data) VALUES (?, ?)',
    quiz.id,
    JSON.stringify(quiz),
  );
}

export function savePlayerToDb(sql: SqlStorageLike, player: PlayerState, sessionHash: string): void {
  sql.exec(
    `INSERT OR REPLACE INTO players (player_id, session_hash, nickname, avatar, joined_at, score, connection_generation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    player.id,
    sessionHash,
    player.nickname,
    player.avatarId,
    player.joinedAt,
    player.score,
    player.connectionGeneration,
  );
  sql.exec(
    'INSERT OR IGNORE INTO participation_history(player_id,joined_at) VALUES(?,?)',
    player.id,
    player.joinedAt,
  );
}

export function savePlayerScoreToDb(sql: SqlStorageLike, player: PlayerState): void {
  sql.exec(
    'UPDATE players SET score = ?, connection_generation = ? WHERE player_id = ?',
    player.score,
    player.connectionGeneration,
    player.id,
  );
}

export function removeLobbyPlayerFromDb(sql: SqlStorageLike, playerId: string, sessionHash: string): boolean {
  const rows = Array.from(
    sql.exec('SELECT session_hash FROM players WHERE player_id = ? LIMIT 1', playerId),
  ) as any[];
  const stored = rows[0]?.session_hash ?? rows[0]?.[0];
  if (!stored || stored !== sessionHash) return false;
  sql.exec('DELETE FROM players WHERE player_id = ? AND session_hash = ?', playerId, sessionHash);
  return true;
}

export function saveRoundToDb(sql: SqlStorageLike, round: ActiveRoundState): void {
  sql.exec(
    `INSERT OR REPLACE INTO rounds (round_id, question_index, question_id, type, starts_at, ends_at, stats_ends_at, ranking_ends_at, closed, scored)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    round.roundId,
    round.questionIndex,
    round.questionId,
    round.type,
    round.startsAt,
    round.endsAt,
    round.statsEndsAt,
    round.rankingEndsAt,
    round.closed ? 1 : 0,
    round.scored ? 1 : 0,
  );
}

export function saveAnswerToDb(sql: SqlStorageLike, answer: AnswerRecord): void {
  sql.exec(
    `INSERT OR REPLACE INTO answers (round_id, player_id, submission_id, payload_digest, option_id, text_answer, received_at, status, is_correct, points_awarded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    answer.roundId,
    answer.playerId,
    answer.submissionId,
    answer.payloadDigest,
    answer.optionId || null,
    answer.textAnswer || null,
    answer.receivedAt,
    answer.status,
    answer.isCorrect !== undefined ? (answer.isCorrect ? 1 : 0) : null,
    answer.pointsAwarded !== undefined ? answer.pointsAwarded : null,
  );
}

export function saveRoomMetaToDb(sql: SqlStorageLike, state: GameState): void {
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'roomId', state.roomId);
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'phase', state.phase);
  sql.exec(
    'INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)',
    'stateVersion',
    state.stateVersion.toString(),
  );
  sql.exec(
    'INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)',
    'currentQuestionIndex',
    state.currentQuestionIndex.toString(),
  );
  sql.exec(
    'INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)',
    'pausedQueued',
    state.pausedQueued ? 'true' : 'false',
  );
}
