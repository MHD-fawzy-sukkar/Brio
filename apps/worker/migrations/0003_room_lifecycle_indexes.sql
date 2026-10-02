-- Repair any historical duplicate active slots before enforcing the invariant.
UPDATE room_directory
SET status = 'finished', event_expires_at = CURRENT_TIMESTAMP
WHERE status IN ('reserved', 'active')
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM room_directory
    WHERE status IN ('reserved', 'active')
    GROUP BY creator_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_one_active_creator
ON room_directory(creator_id)
WHERE status IN ('reserved', 'active');

CREATE INDEX IF NOT EXISTS idx_room_capacity_status_expiry
ON room_directory(status, event_expires_at);
