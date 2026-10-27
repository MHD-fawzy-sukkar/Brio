import {
  createCompetitionIdentity,
  CompetitionIdentitySchema,
  SaveIdentityRequestSchema,
  type CompetitionIdentity,
  type SaveIdentityRequest,
  type IdentityRecordDto,
} from '@brio/contracts';
import { prepareThemeCopy } from './theme-library.repository';
import { IdentityError } from '../identities/identity-error';

interface IdentityRow {
  id: string;
  input_json: string;
  identity_json: string;
  visibility: 'private' | 'public';
  design_locked: number;
}
function toDto(row: IdentityRow): IdentityRecordDto {
  return {
    ...SaveIdentityRequestSchema.parse(JSON.parse(row.input_json)),
    visibility: 'private',
    publishConfirmed: false,
    designLocked: Boolean(row.design_locked),
    id: row.id,
    identity: CompetitionIdentitySchema.parse(JSON.parse(row.identity_json)),
  };
}

export async function listIdentities(db: D1Database, creatorId: string): Promise<IdentityRecordDto[]> {
  const { results } = await db
    .prepare(
      'SELECT id, input_json, identity_json, visibility, design_locked FROM competition_identities WHERE creator_id=? AND archived_at IS NULL AND design_locked=0 AND library_hidden=0 ORDER BY updated_at DESC LIMIT 100',
    )
    .bind(creatorId)
    .all<IdentityRow>();
  return (results || []).map(toDto);
}

export async function getIdentity(
  db: D1Database,
  id: string,
  creatorId: string,
): Promise<IdentityRecordDto | null> {
  const row = await db
    .prepare(
      'SELECT id, input_json, identity_json, visibility, design_locked FROM competition_identities WHERE id=? AND creator_id=? AND archived_at IS NULL',
    )
    .bind(id, creatorId)
    .first<IdentityRow>();
  return row ? toDto(row) : null;
}

export async function resolveOwnedIdentity(
  db: D1Database,
  creatorId: string,
  input: SaveIdentityRequest,
): Promise<CompetitionIdentity> {
  const { results } = await db
    .prepare(
      `SELECT id, source_url FROM identity_assets WHERE creator_id=? AND design_locked=0 AND id IN (${input.images.map(() => '?').join(',')})`,
    )
    .bind(creatorId, ...input.images.map((image) => image.mediaId))
    .all<{ id: string; source_url: string }>();
  const assets = new Map((results || []).map((asset) => [asset.id, asset.source_url]));
  if (input.images.some((image) => !assets.has(image.mediaId)))
    throw new IdentityError('إحدى الصور غير موجودة أو لا تخص حسابك.');
  return createCompetitionIdentity(input, assets);
}

export async function saveIdentity(
  db: D1Database,
  creatorId: string,
  input: SaveIdentityRequest,
  id: string = crypto.randomUUID(),
): Promise<IdentityRecordDto> {
  const previous = await getIdentity(db, id, creatorId);
  if (previous?.designLocked)
    throw new IdentityError('هذه الهوية للاستخدام فقط؛ لا يمكنك تعديل تصميمها.', 403);
  requirePrivateIdentity(input);
  const identity = await resolveOwnedIdentity(db, creatorId, input);
  // Updates cannot transfer ownership or revive an archived identity.
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  statements.push(
    db
      .prepare(
        `INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,input_json=excluded.input_json,
    identity_json=excluded.identity_json,updated_at=excluded.updated_at,visibility=excluded.visibility
    WHERE competition_identities.creator_id=excluded.creator_id AND competition_identities.archived_at IS NULL`,
      )
      .bind(
        id,
        creatorId,
        input.name,
        JSON.stringify(input),
        JSON.stringify(identity),
        now,
        input.visibility,
      ),
  );
  if (previous) {
    // Update only this creator's linked drafts; published versions and live rooms are immutable snapshots.
    const privateInput = { ...input, visibility: 'private', publishConfirmed: false };
    statements.push(
      db
        .prepare(
          'UPDATE competition_identities SET name=?,input_json=?,identity_json=?,updated_at=? WHERE source_theme_id=? AND creator_id=? AND archived_at IS NULL',
        )
        .bind(input.name, JSON.stringify(privateInput), JSON.stringify(identity), now, id, creatorId),
    );
    statements.push(
      db
        .prepare(
          'UPDATE quizzes SET updated_at=? WHERE creator_id=? AND archived_at IS NULL AND identity_id IN (SELECT id FROM competition_identities WHERE id=? OR (source_theme_id=? AND creator_id=?))',
        )
        .bind(now, creatorId, id, id, creatorId),
    );
  }
  const results = await db.batch(statements);
  if (!results[0].meta.changes) throw new IdentityError('الهوية غير موجودة.', 404);
  return { ...input, id, identity };
}

export function requirePrivateIdentity(input: SaveIdentityRequest) {
  if (input.visibility !== 'private') throw new IdentityError('الهويات متاحة لمسابقات صاحبها فقط.');
}

export async function assignQuizIdentity(
  db: D1Database,
  quizId: string,
  creatorId: string,
  identityId: string | null,
) {
  if (
    !(await db
      .prepare('SELECT id FROM quizzes WHERE id=? AND creator_id=? AND archived_at IS NULL')
      .bind(quizId, creatorId)
      .first())
  )
    throw new IdentityError('المسابقة غير موجودة أو لا تخص حسابك.', 404);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let assignedId: string | null = null;
  if (identityId) {
    const copy = await prepareThemeCopy(db, identityId, creatorId);
    assignedId = crypto.randomUUID();
    statements.push(
      ...copy.statements,
      db
        .prepare(
          'INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility,design_locked,library_hidden,source_theme_id) VALUES(?,?,?,?,?,?,?,?,1,?)',
        )
        .bind(
          assignedId,
          creatorId,
          copy.input.name,
          JSON.stringify(copy.input),
          JSON.stringify(copy.identity),
          now,
          'private',
          copy.designLocked ? 1 : 0,
          copy.designLocked ? null : identityId,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        'UPDATE quizzes SET identity_id=?,updated_at=? WHERE id=? AND creator_id=? AND archived_at IS NULL',
      )
      .bind(assignedId, now, quizId, creatorId),
  );
  await db.batch(statements);
  return assignedId;
}

export async function archiveIdentity(db: D1Database, id: string, creatorId: string) {
  const previous = await getIdentity(db, id, creatorId);
  if (!previous) throw new IdentityError('الهوية غير موجودة.', 404);
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        'UPDATE quizzes SET identity_id=NULL,updated_at=? WHERE creator_id=? AND identity_id IN (SELECT id FROM competition_identities WHERE creator_id=? AND (id=? OR source_theme_id=?))',
      )
      .bind(now, creatorId, creatorId, id, id),
    db
      .prepare(
        'UPDATE competition_identities SET archived_at=? WHERE creator_id=? AND (id=? OR source_theme_id=?)',
      )
      .bind(now, creatorId, id, id),
  ]);
}

export async function quizIdentity(
  db: D1Database,
  identityId: string | null | undefined,
  creatorId: string,
): Promise<CompetitionIdentity | undefined> {
  if (!identityId) return undefined;
  const record = await getIdentity(db, identityId, creatorId);
  if (!record) throw new IdentityError('هوية المسابقة لم تعد متاحة. اختر هوية أخرى.');
  return record.identity;
}
