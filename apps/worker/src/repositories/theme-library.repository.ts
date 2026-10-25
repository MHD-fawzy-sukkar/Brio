import { CompetitionIdentitySchema, SaveIdentityRequestSchema, createCompetitionIdentity, type ThemeSummaryDto } from '@brio/contracts';
import { IdentityError } from '../http/problem';

type ThemeRow = { id: string; name: string; creator_id: string; visibility: 'public' | 'private'; identity_json: string };
type ThemeSource = { creator_id: string; input_json: string; design_locked: number };

export async function listThemes(db: D1Database, creatorId: string): Promise<ThemeSummaryDto[]> {
  const groups = await Promise.all([
    db.prepare('SELECT id,name,creator_id,visibility,identity_json FROM competition_identities WHERE creator_id=? AND archived_at IS NULL AND design_locked=0 ORDER BY updated_at DESC LIMIT 100').bind(creatorId).all<ThemeRow>(),
    db.prepare("SELECT id,name,creator_id,visibility,identity_json FROM competition_identities WHERE visibility='public' AND creator_id!=? AND archived_at IS NULL AND design_locked=0 ORDER BY updated_at DESC LIMIT 50").bind(creatorId).all<ThemeRow>()
  ]);
  return groups.flatMap(group => group.results ?? []).map(row => ({
    id: row.id, name: row.name, visibility: row.visibility, owned: row.creator_id === creatorId,
    identity: CompetitionIdentitySchema.parse(JSON.parse(row.identity_json))
  }));
}

export async function setThemeVisibility(db: D1Database, id: string, creatorId: string, visibility: 'public' | 'private', confirmed = false) {
  if (visibility === 'public' && !confirmed) throw new IdentityError('أكد نشر الثيم وإتاحة صوره للجميع أولاً.');
  const result = await db.prepare('UPDATE competition_identities SET visibility=?,updated_at=? WHERE id=? AND creator_id=? AND archived_at IS NULL AND design_locked=0')
    .bind(visibility, new Date().toISOString(), id, creatorId).run();
  if (!result.meta.changes) throw new IdentityError('الثيم غير موجود أو لا يخص حسابك.', 404);
}

/** Copy readable artwork into independent owned asset references, without duplicating image bytes. */
export async function prepareThemeCopy(db: D1Database, themeId: string, creatorId: string) {
  const row = await db.prepare("SELECT creator_id,input_json,design_locked FROM competition_identities WHERE id=? AND archived_at IS NULL AND (creator_id=? OR visibility='public')")
    .bind(themeId, creatorId).first<ThemeSource>();
  if (!row) throw new IdentityError('الثيم غير متاح. ربما أصبح خاصاً أو أُزيل.', 404);
  const designLocked = row.creator_id !== creatorId || Boolean(row.design_locked);
  const original = SaveIdentityRequestSchema.parse(JSON.parse(row.input_json));
  const { results } = await db.prepare(`SELECT id,source_url FROM identity_assets WHERE creator_id=? AND id IN (${original.images.map(() => '?').join(',')})`)
    .bind(row.creator_id, ...original.images.map(image => image.mediaId)).all<{ id: string; source_url: string }>();
  const sourceMap = new Map((results ?? []).map(asset => [asset.id, asset.source_url]));
  const sources = new Map<string, string>();
  const statements: D1PreparedStatement[] = [];
  const images = original.images.map(image => {
    const src = sourceMap.get(image.mediaId);
    if (!src) throw new IdentityError('إحدى صور الثيم لم تعد متاحة.');
    const mediaId = crypto.randomUUID();
    sources.set(mediaId, src);
    statements.push(db.prepare('INSERT INTO identity_assets(id,creator_id,source_url,created_at,design_locked) VALUES(?,?,?,?,?)')
      .bind(mediaId, creatorId, src, new Date().toISOString(), designLocked ? 1 : 0));
    return { ...image, mediaId };
  });
  // Using a public theme never publishes the user's copy without explicit consent.
  const input = { ...original, images, visibility: 'private' as const, publishConfirmed: false, avatarMode: 'auto' as const, motion: 'float' as const };
  return { input, identity: createCompetitionIdentity(input, sources), statements, designLocked };
}
