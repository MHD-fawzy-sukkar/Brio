import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createTestDatabase } from '../testing/d1';

test('design-lock migration protects earlier foreign copies without locking original or unrecognized assets', () => {
  const { sqlite } = createTestDatabase(5);
  try {
    for (const id of ['owner', 'other']) sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run(id, id, id, `${id}@invalid`, '2026-01-01');
    const source = 'https://res.cloudinary.com/brio/image/upload/v1/brio/owner/identities/original.webp';
    const asset = sqlite.prepare('INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?)');
    asset.run('original', 'owner', source, '2026-01-01');
    asset.run('copy', 'other', source, '2026-01-01');
    asset.run('legacy', 'other', 'https://res.cloudinary.com/brio/image/upload/v1/legacy.webp', '2026-01-01');
    const identity = sqlite.prepare("INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility) VALUES(?,?,?,?,'{}','2026-01-01','public')");
    identity.run('original', 'owner', 'Original', JSON.stringify({ images: [{ mediaId: 'original' }] }));
    identity.run('copy', 'other', 'Copy', JSON.stringify({ images: [{ mediaId: 'copy' }] }));
    sqlite.exec(readFileSync(new URL('../../migrations/0006_theme_design_lock.sql', import.meta.url), 'utf8'));
    assert.equal(sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('original')!.design_locked, 0);
    assert.equal(sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('copy')!.design_locked, 1);
    assert.equal(sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('legacy')!.design_locked, 0);
    assert.equal(sqlite.prepare('SELECT visibility FROM competition_identities WHERE id=?').get('original')!.visibility, 'public');
    assert.equal(sqlite.prepare('SELECT visibility FROM competition_identities WHERE id=?').get('copy')!.visibility, 'private');
  } finally { sqlite.close(); }
});
