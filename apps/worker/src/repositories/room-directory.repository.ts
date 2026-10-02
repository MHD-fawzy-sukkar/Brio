export interface RoomDirectoryRecord {
  room_id: string;
  code: string;
  creator_id: string;
  quiz_version_id: string;
  status: 'reserved' | 'active' | 'finished' | 'expired';
  reservation_expires_at: string;
  event_expires_at: string;
}

export function generateRoomCode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function reserveRoomSlot(
  db: D1Database,
  creatorId: string,
  quizVersionId: string
): Promise<{ roomId: string; code: string; replacedRoomIds: string[] }> {
  const nowIso = new Date().toISOString();

  // Expired rows must never consume pilot capacity, even if housekeeping was delayed.
  await db.prepare("UPDATE room_directory SET status = 'expired' WHERE status IN ('reserved', 'active') AND event_expires_at <= ?")
    .bind(nowIso).run();

  // A creator starting a new room replaces any previous room. This is the
  // server-side safety net for closed tabs, network loss, and interrupted hosts.
  const { results: previousRooms } = await db
    .prepare("SELECT room_id FROM room_directory WHERE creator_id = ? AND status IN ('reserved', 'active')")
    .bind(creatorId)
    .all<{ room_id: string }>();
  const replacedRoomIds = (previousRooms || []).map((room) => room.room_id);
  if (replacedRoomIds.length > 0) {
    await db.prepare("UPDATE room_directory SET status = 'finished', event_expires_at = ? WHERE creator_id = ? AND status IN ('reserved', 'active')")
      .bind(nowIso, creatorId).run();
  }

  // Global Pilot Ceiling: max 2 active rooms deployment-wide.
  const globalActive = await db
    .prepare("SELECT COUNT(*) as cnt FROM room_directory WHERE status IN ('reserved', 'active') AND event_expires_at > ?")
    .bind(nowIso)
    .first<{ cnt: number }>();

  if (globalActive && globalActive.cnt >= 2) {
    throw new Error('Global pilot capacity reached: At most 2 concurrent active rooms allowed');
  }

  const roomId = crypto.randomUUID();
  const code = generateRoomCode();

  const reservationExpiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString(); // 45 min lobby TTL
  const eventExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();     // 4 hour max event budget

  await db
    .prepare(`
      INSERT INTO room_directory (room_id, code, creator_id, quiz_version_id, status, reservation_expires_at, event_expires_at)
      VALUES (?, ?, ?, ?, 'reserved', ?, ?)
    `)
    .bind(roomId, code, creatorId, quizVersionId, reservationExpiresAt, eventExpiresAt)
    .run();

  return { roomId, code, replacedRoomIds };
}

export async function markRoomFinished(db: D1Database, roomId: string): Promise<void> {
  await db
    .prepare("UPDATE room_directory SET status = 'finished', event_expires_at = ? WHERE room_id = ? AND status IN ('reserved', 'active')")
    .bind(new Date().toISOString(), roomId)
    .run();
}

export async function finishRoomForCreator(db: D1Database, roomId: string, creatorId: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE room_directory SET status = 'finished', event_expires_at = ? WHERE room_id = ? AND creator_id = ? AND status IN ('reserved', 'active')")
    .bind(new Date().toISOString(), roomId, creatorId)
    .run();
  return Number(result.meta.changes) > 0;
}

export async function findRoomForCreator(db: D1Database, roomId: string, creatorId: string): Promise<RoomDirectoryRecord | null> {
  const row = await db
    .prepare('SELECT room_id, code, creator_id, quiz_version_id, status, reservation_expires_at, event_expires_at FROM room_directory WHERE room_id = ? AND creator_id = ?')
    .bind(roomId, creatorId)
    .first<RoomDirectoryRecord>();
  return row || null;
}

export async function findRoomByCode(
  db: D1Database,
  code: string
): Promise<RoomDirectoryRecord | null> {
  const nowIso = new Date().toISOString();
  const row = await db
    .prepare("SELECT room_id, code, creator_id, quiz_version_id, status, reservation_expires_at, event_expires_at FROM room_directory WHERE code = ? AND status IN ('reserved', 'active') AND event_expires_at > ?")
    .bind(code, nowIso)
    .first<RoomDirectoryRecord>();

  return row || null;
}

export async function findJoinableRoomById(db: D1Database, roomId: string): Promise<RoomDirectoryRecord | null> {
  const row = await db.prepare("SELECT room_id, code, creator_id, quiz_version_id, status, reservation_expires_at, event_expires_at FROM room_directory WHERE room_id = ? AND status IN ('reserved', 'active') AND event_expires_at > ?")
    .bind(roomId, new Date().toISOString()).first<RoomDirectoryRecord>();
  return row || null;
}
