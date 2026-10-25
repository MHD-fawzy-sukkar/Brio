CREATE TABLE competition_identities (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  identity_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_identities_owner ON competition_identities(creator_id, archived_at, updated_at);
CREATE TABLE identity_assets (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_identity_assets_owner ON identity_assets(creator_id);
ALTER TABLE quizzes ADD COLUMN identity_id TEXT REFERENCES competition_identities(id);
