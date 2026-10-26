import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCompetitionIdentity, SaveIdentityRequestSchema } from '@brio/contracts';
import { createTestDatabase } from '../testing/d1';

test('design-lock migration protects earlier foreign copies without locking original or unrecognized assets', () => {
  const { sqlite } = createTestDatabase(5);
  try {
    for (const id of ['owner', 'other'])
      sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run(id, id, id, `${id}@invalid`, '2026-01-01');
    const source = 'https://res.cloudinary.com/brio/image/upload/v1/brio/owner/identities/original.webp';
    const asset = sqlite.prepare(
      'INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?)',
    );
    asset.run('original', 'owner', source, '2026-01-01');
    asset.run('copy', 'other', source, '2026-01-01');
    asset.run('legacy', 'other', 'https://res.cloudinary.com/brio/image/upload/v1/legacy.webp', '2026-01-01');
    const identity = sqlite.prepare(
      "INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility) VALUES(?,?,?,?,'{}','2026-01-01','public')",
    );
    identity.run('original', 'owner', 'Original', JSON.stringify({ images: [{ mediaId: 'original' }] }));
    identity.run('copy', 'other', 'Copy', JSON.stringify({ images: [{ mediaId: 'copy' }] }));
    sqlite.exec(
      readFileSync(new URL('../../migrations/0006_theme_design_lock.sql', import.meta.url), 'utf8'),
    );
    assert.equal(
      sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('original')!.design_locked,
      0,
    );
    assert.equal(
      sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('copy')!.design_locked,
      1,
    );
    assert.equal(
      sqlite.prepare('SELECT design_locked FROM identity_assets WHERE id=?').get('legacy')!.design_locked,
      0,
    );
    assert.equal(
      sqlite.prepare('SELECT visibility FROM competition_identities WHERE id=?').get('original')!.visibility,
      'public',
    );
    assert.equal(
      sqlite.prepare('SELECT visibility FROM competition_identities WHERE id=?').get('copy')!.visibility,
      'private',
    );
  } finally {
    sqlite.close();
  }
});

test('owned-theme lineage migration recovers unchanged copies and keeps customized or foreign designs independent', () => {
  const { sqlite } = createTestDatabase(7);
  try {
    for (const id of ['owner', 'other'])
      sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run(id, id, id, `${id}@invalid`, '2026-01-01');
    const originalId = '00000000-0000-4000-8000-000000000001';
    const copiedId = '00000000-0000-4000-8000-000000000002';
    const url = 'https://res.cloudinary.com/brio/image/upload/team.webp';
    for (const [id, owner] of [
      [originalId, 'owner'],
      [copiedId, 'owner'],
    ])
      sqlite
        .prepare('INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?)')
        .run(id, owner, url, 'now');
    const add = (
      id: string,
      mediaId: string,
      updated: string,
      hidden = 0,
      accent = 'brio',
      creator = 'owner',
      locked = 0,
    ) => {
      const input = SaveIdentityRequestSchema.parse({
        name: 'Team',
        images: [{ mediaId, label: 'Team', roles: ['character', 'avatar'] }],
        accent,
      });
      const identity = createCompetitionIdentity(input, new Map([[mediaId, url]]));
      sqlite
        .prepare(
          'INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,library_hidden,design_locked) VALUES(?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          creator,
          input.name,
          JSON.stringify(input),
          JSON.stringify(identity),
          updated,
          hidden,
          locked,
        );
    };
    add('original', originalId, '2026-01-01');
    add('copy', copiedId, '2026-01-02', 1);
    add('customized', copiedId, '2026-01-02', 1, 'forest');
    add('foreign', copiedId, '2026-01-02', 1, 'brio', 'other', 1);
    sqlite.exec(
      readFileSync(new URL('../../migrations/0008_link_owned_themes.sql', import.meta.url), 'utf8'),
    );
    assert.equal(
      sqlite.prepare('SELECT source_theme_id FROM competition_identities WHERE id=?').get('copy')!
        .source_theme_id,
      'original',
    );
    for (const id of ['original', 'customized', 'foreign'])
      assert.equal(
        sqlite.prepare('SELECT source_theme_id FROM competition_identities WHERE id=?').get(id)!
          .source_theme_id,
        null,
      );
  } finally {
    sqlite.close();
  }
});
