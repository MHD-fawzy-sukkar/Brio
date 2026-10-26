-- Snapshot freshness allows statistics to load without waiting for room objects.
ALTER TABLE creator_room_participations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
