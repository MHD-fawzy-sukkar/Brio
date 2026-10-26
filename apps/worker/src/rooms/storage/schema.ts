import type { SqlStorageLike } from './types';

export function initRoomDbSchema(sql: SqlStorageLike): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS room_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS quiz_snapshot (
      id TEXT PRIMARY KEY,
      json_data TEXT NOT NULL
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      session_hash TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      connection_generation INTEGER NOT NULL DEFAULT 1
    );
  `);

  sql.exec(
    'CREATE TABLE IF NOT EXISTS participation_history(player_id TEXT PRIMARY KEY, joined_at INTEGER NOT NULL)',
  );
  sql.exec(
    'INSERT OR IGNORE INTO participation_history(player_id,joined_at) SELECT player_id,joined_at FROM players',
  );

  sql.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      round_id TEXT PRIMARY KEY,
      question_index INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      type TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      stats_ends_at INTEGER NOT NULL,
      ranking_ends_at INTEGER NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0,
      scored INTEGER NOT NULL DEFAULT 0
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      round_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      option_id TEXT,
      text_answer TEXT,
      received_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      is_correct INTEGER,
      points_awarded INTEGER,
      PRIMARY KEY (round_id, player_id)
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      job_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      next_attempt_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}
