ALTER TABLE competition_identities ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public'));
CREATE INDEX idx_identities_public ON competition_identities(visibility, archived_at, updated_at);
