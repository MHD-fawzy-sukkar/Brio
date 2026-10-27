import {
  CompetitionIdentitySchema,
  SaveIdentityRequestSchema,
  createCompetitionIdentity,
  type ThemeSummaryDto,
} from '@brio/contracts';
import { IdentityError } from '../identities/identity-error';

type ThemeRow = {
  id: string;
  name: string;
  creator_id: string;
  visibility: 'public' | 'private';
  identity_json: string;
};
type ThemeSource = { creator_id: string; input_json: string; design_locked: number };

export async function listThemes(db: D1Database, creatorId: string): Promise<ThemeSummaryDto[]> {
  const { results } = await db
    .prepare(
      'SELECT id,name,creator_id,visibility,identity_json FROM competition_identities WHERE creator_id=? AND archived_at IS NULL AND design_locked=0 AND library_hidden=0 ORDER BY updated_at DESC LIMIT 100',
    )
    .bind(creatorId)
    .all<ThemeRow>();
  return (results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    visibility: 'private' as const,
    owned: true,
    identity: CompetitionIdentitySchema.parse(JSON.parse(row.identity_json)),
  }));
}

/** Copy readable artwork into independent owned asset references, without duplicating image bytes. */
export async function prepareThemeCopy(db: D1Database, themeId: string, creatorId: string) {
  const row = await db
    .prepare(
      'SELECT creator_id,input_json,design_locked FROM competition_identities WHERE id=? AND archived_at IS NULL AND creator_id=?',
    )
    .bind(themeId, creatorId)
    .first<ThemeSource>();
  if (!row) throw new IdentityError('الهوية غير موجودة أو لا تخص حسابك.', 404);
  const designLocked = row.creator_id !== creatorId || Boolean(row.design_locked);
  const original = SaveIdentityRequestSchema.parse(JSON.parse(row.input_json));
  const { results } = await db
    .prepare(
      `SELECT id,source_url FROM identity_assets WHERE creator_id=? AND id IN (${original.images.map(() => '?').join(',')})`,
    )
    .bind(row.creator_id, ...original.images.map((image) => image.mediaId))
    .all<{ id: string; source_url: string }>();
  const sourceMap = new Map((results ?? []).map((asset) => [asset.id, asset.source_url]));
  const sources = new Map<string, string>();
  const statements: D1PreparedStatement[] = [];
  const images = original.images.map((image) => {
    const src = sourceMap.get(image.mediaId);
    if (!src) throw new IdentityError('إحدى صور الهوية لم تعد متاحة.');
    const mediaId = crypto.randomUUID();
    sources.set(mediaId, src);
    statements.push(
      db
        .prepare(
          'INSERT INTO identity_assets(id,creator_id,source_url,created_at,design_locked) VALUES(?,?,?,?,?)',
        )
        .bind(mediaId, creatorId, src, new Date().toISOString(), designLocked ? 1 : 0),
    );
    return { ...image, mediaId };
  });
  // Reuse stays within the owner account; existing locked snapshots remain read-only.
  const input = {
    ...original,
    images,
    visibility: 'private' as const,
    publishConfirmed: false,
    avatarMode: 'auto' as const,
    motion: 'float' as const,
  };
  return { input, identity: createCompetitionIdentity(input, sources), statements, designLocked };
}
