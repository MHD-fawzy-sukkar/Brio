import { createCompetitionIdentity, CompetitionIdentitySchema, SaveIdentityRequestSchema, type CompetitionIdentity, type SaveIdentityRequest, type IdentityRecordDto } from '@brio/contracts';
import { IdentityError } from '../http/problem';

interface IdentityRow { id: string; input_json: string; identity_json: string; visibility: 'private' | 'public'; design_locked: number }
function toDto(row: IdentityRow): IdentityRecordDto {
  return { ...SaveIdentityRequestSchema.parse(JSON.parse(row.input_json)), visibility: row.visibility, designLocked: Boolean(row.design_locked), id: row.id, identity: CompetitionIdentitySchema.parse(JSON.parse(row.identity_json)) };
}

export async function listIdentities(db: D1Database, creatorId: string): Promise<IdentityRecordDto[]> {
  const { results } = await db.prepare('SELECT id, input_json, identity_json, visibility, design_locked FROM competition_identities WHERE creator_id=? AND archived_at IS NULL AND design_locked=0 ORDER BY updated_at DESC LIMIT 100')
    .bind(creatorId).all<IdentityRow>();
  return (results || []).map(toDto);
}

export async function getIdentity(db: D1Database, id: string, creatorId: string): Promise<IdentityRecordDto | null> {
  const row = await db.prepare('SELECT id, input_json, identity_json, visibility, design_locked FROM competition_identities WHERE id=? AND creator_id=? AND archived_at IS NULL')
    .bind(id, creatorId).first<IdentityRow>();
  return row ? toDto(row) : null;
}

export async function resolveOwnedIdentity(db: D1Database, creatorId: string, input: SaveIdentityRequest): Promise<CompetitionIdentity> {
  const { results } = await db.prepare(`SELECT id, source_url FROM identity_assets WHERE creator_id=? AND design_locked=0 AND id IN (${input.images.map(() => '?').join(',')})`)
    .bind(creatorId, ...input.images.map(image => image.mediaId)).all<{ id: string; source_url: string }>();
  const assets = new Map((results || []).map(asset => [asset.id, asset.source_url]));
  if (input.images.some(image => !assets.has(image.mediaId))) throw new IdentityError('إحدى الصور غير موجودة أو لا تخص حسابك.');
  return createCompetitionIdentity(input, assets);
}

export async function saveIdentity(db: D1Database, creatorId: string, input: SaveIdentityRequest, id: string = crypto.randomUUID()): Promise<IdentityRecordDto> {
  const previous = await getIdentity(db, id, creatorId);
  if (previous?.designLocked) throw new IdentityError('هذا الثيم للاستخدام فقط؛ لا يمكنك تعديل تصميمه.', 403);
  requirePublicationConfirmation(input);
  const identity = await resolveOwnedIdentity(db, creatorId, input);
  // Updates cannot transfer ownership or revive an archived identity.
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  if (previous && await db.prepare('SELECT id FROM quizzes WHERE identity_id=? AND creator_id=? AND archived_at IS NULL LIMIT 1').bind(id, creatorId).first()) {
    // Library edits must not rewrite the drafts already using this template.
    const preservedId = crypto.randomUUID();
    const preserved = SaveIdentityRequestSchema.parse({ ...previous, visibility: 'private', publishConfirmed: false });
    statements.push(db.prepare('INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility) VALUES(?,?,?,?,?,?,?)')
      .bind(preservedId, creatorId, previous.name, JSON.stringify(preserved), JSON.stringify(previous.identity), now, 'private'));
    statements.push(db.prepare('UPDATE quizzes SET identity_id=? WHERE identity_id=? AND creator_id=? AND archived_at IS NULL').bind(preservedId, id, creatorId));
  }
  statements.push(db.prepare(`INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,input_json=excluded.input_json,
    identity_json=excluded.identity_json,updated_at=excluded.updated_at,visibility=excluded.visibility
    WHERE competition_identities.creator_id=excluded.creator_id AND competition_identities.archived_at IS NULL`)
    .bind(id, creatorId, input.name, JSON.stringify(input), JSON.stringify(identity), now, input.visibility));
  const results = await db.batch(statements);
  if (!results[results.length - 1].meta.changes) throw new IdentityError('الهوية غير موجودة.', 404);
  return { ...input, id, identity };
}

export function requirePublicationConfirmation(input: SaveIdentityRequest) {
  if (input.visibility === 'public' && input.publishConfirmed !== true) throw new IdentityError('أكد نشر الثيم وإتاحة هويته وصوره للجميع أولاً.');
}

export async function assignQuizIdentity(db: D1Database, quizId: string, creatorId: string, identityId: string | null) {
  const result = await db.prepare(`UPDATE quizzes SET identity_id=?,updated_at=? WHERE id=? AND creator_id=? AND archived_at IS NULL
    AND (? IS NULL OR EXISTS(SELECT 1 FROM competition_identities i WHERE i.id=? AND i.creator_id=? AND i.archived_at IS NULL))`)
    .bind(identityId, new Date().toISOString(), quizId, creatorId, identityId, identityId, creatorId).run();
  if (!result.meta.changes) throw new IdentityError('المسابقة أو الهوية غير موجودة أو لا تخص حسابك.', 404);
}

export async function archiveIdentity(db: D1Database, id: string, creatorId: string) {
  if (!await getIdentity(db, id, creatorId)) throw new IdentityError('الهوية غير موجودة.', 404);
  await db.batch([
    db.prepare('UPDATE quizzes SET identity_id=NULL,updated_at=? WHERE identity_id=? AND creator_id=?').bind(new Date().toISOString(), id, creatorId),
    db.prepare('UPDATE competition_identities SET archived_at=? WHERE id=? AND creator_id=?').bind(new Date().toISOString(), id, creatorId)
  ]);
}

export async function quizIdentity(db: D1Database, identityId: string | null | undefined, creatorId: string): Promise<CompetitionIdentity | undefined> {
  if (!identityId) return undefined;
  const record = await getIdentity(db, identityId, creatorId);
  if (!record) throw new IdentityError('هوية المسابقة لم تعد متاحة. اختر هوية أخرى.');
  return record.identity;
}
