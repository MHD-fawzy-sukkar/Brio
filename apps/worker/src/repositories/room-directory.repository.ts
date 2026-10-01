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
): Promise<{ roomId: string; code: string }> {
  const nowIso = new Date().toISOString();

  // 1. Check Creator Limit: max 1 active room per creator
  const creatorActive = await db
    .prepare("SELECT COUNT(*) as cnt FROM room_directory WHERE creator_id = ? AND status IN ('reserved', 'active') AND event_expires_at > ?")
    .bind(creatorId, nowIso)
    .first<{ cnt: number }>();

  if (creatorActive && creatorActive.cnt >= 1) {
    throw new Error('Creator quota exceeded: At most 1 active room per creator is allowed');
  }

  // 2. Check Global Pilot Ceiling: max 2 active rooms deployment-wide
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

  return { roomId, code };
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
