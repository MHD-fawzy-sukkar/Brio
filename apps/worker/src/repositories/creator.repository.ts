export interface CreatorRecord {
  id: string;
  google_sub: string;
  display_name: string;
  email: string;
  created_at: string;
}

export async function findOrCreateCreator(
  db: D1Database,
  googleSub: string,
  email: string,
  displayName: string
): Promise<CreatorRecord> {
  const existing = await db
    .prepare('SELECT id, google_sub, display_name, email, created_at FROM creators WHERE google_sub = ?')
    .bind(googleSub)
    .first<CreatorRecord>();

  if (existing) {
    return existing;
  }

  const newCreator: CreatorRecord = {
    id: crypto.randomUUID(),
    google_sub: googleSub,
    display_name: displayName,
    email: email,
    created_at: new Date().toISOString()
  };

  await db
    .prepare('INSERT INTO creators (id, google_sub, display_name, email, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(newCreator.id, newCreator.google_sub, newCreator.display_name, newCreator.email, newCreator.created_at)
    .run();

  return newCreator;
}

export async function createSessionRecord(
  db: D1Database,
  creatorId: string,
  sessionHash: string,
  expiresAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO creator_sessions (id_hash, creator_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionHash, creatorId, expiresAt, now)
    .run();
}

export async function findCreatorBySessionHash(
  db: D1Database,
  sessionHash: string
): Promise<CreatorRecord | null> {
  const now = new Date().toISOString();
  const row = await db
    .prepare(`
      SELECT c.id, c.google_sub, c.display_name, c.email, c.created_at
      FROM creator_sessions s
      JOIN creators c ON s.creator_id = c.id
      WHERE s.id_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL
    `)
    .bind(sessionHash, now)
    .first<CreatorRecord>();

  return row || null;
}

export async function revokeSessionRecord(db: D1Database, sessionHash: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE creator_sessions SET revoked_at = ? WHERE id_hash = ?')
    .bind(now, sessionHash)
    .run();
}
