-- One compact, monotonic total per room; no player identities are copied to D1.
CREATE TABLE creator_room_participations (
  room_id TEXT PRIMARY KEY REFERENCES room_directory(room_id),
  total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
  finalized INTEGER NOT NULL DEFAULT 0 CHECK(finalized IN (0,1))
);
INSERT INTO creator_room_participations(room_id,total)
SELECT r.room_id,COUNT(p.player_id) FROM room_directory r
JOIN archived_player_results p ON p.room_id=r.room_id GROUP BY r.room_id;
