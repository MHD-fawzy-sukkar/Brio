-- Brio D1 Database Migration 0001_initial_schema.sql
-- Logical schema for creators, sessions, quizzes, questions, options, media, versions, and archiving

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_sessions (
  id_hash TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_sessions_creator_id ON creator_sessions(creator_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON quizzes(creator_id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('MultipleChoice', 'TrueFalse', 'ShortAnswer', 'Poll')),
  text TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 20000,
  multiplier TEXT NOT NULL DEFAULT 'Standard' CHECK(multiplier IN ('Standard', 'Double', 'Zero')),
  media_id TEXT,
  essential INTEGER NOT NULL DEFAULT 0,
  normalization_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

CREATE TABLE IF NOT EXISTS question_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);

CREATE TABLE IF NOT EXISTS short_answer_alternatives (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  normalized_value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_short_answer_alternatives_question_id ON short_answer_alternatives(question_id);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  provider_public_id TEXT NOT NULL,
  rendition_json TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready'
);

CREATE TABLE IF NOT EXISTS quiz_versions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  private_snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(quiz_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_quiz_versions_quiz_id ON quiz_versions(quiz_id);

CREATE TABLE IF NOT EXISTS room_directory (
  room_id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  quiz_version_id TEXT NOT NULL REFERENCES quiz_versions(id),
  status TEXT NOT NULL CHECK(status IN ('reserved', 'active', 'finished', 'expired')),
  reservation_expires_at TEXT NOT NULL,
  event_expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archived_sessions (
  room_id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archived_player_results (
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  breakdown_json TEXT NOT NULL,
  PRIMARY KEY (room_id, player_id)
);
