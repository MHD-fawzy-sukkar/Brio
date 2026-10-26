import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../testing/d1';
import { signIdentityUpload, completeIdentityUpload } from '../media/identity-upload';
import { assetId } from './testing-fixtures';
test('new identity uploads are immutable and completion verifies Cloudinary response and owner namespace', async () => {
  const { db, sqlite } = createTestDatabase();
  try {
    sqlite
      .prepare('INSERT INTO creators VALUES(?,?,?,?,?)')
      .run('owner', 'owner', 'owner', 'owner@test.invalid', 'now');
    const env = {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    };
    const signed = await signIdentityUpload(env, 'owner');
    const again = await signIdentityUpload(env, 'owner');
    assert.notEqual(signed.assetId, again.assetId);
    assert.equal(signed.params.overwrite, 'false');
    const publicId = signed.params.public_id,
      version = 123;
    const digest = await crypto.subtle.digest(
      'SHA-1',
      new TextEncoder().encode(`public_id=${publicId}&version=${version}${env.CLOUDINARY_API_SECRET}`),
    );
    const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
    const input = { assetId: signed.assetId, publicId, version, signature };
    await assert.rejects(completeIdentityUpload(db, env, 'other', input));
    await assert.rejects(completeIdentityUpload(db, env, 'owner', { ...input, signature: '0'.repeat(40) }));
    const saved = await completeIdentityUpload(db, env, 'owner', input);
    assert.match(saved.src, /c_pad,w_640,h_640,b_transparent,f_webp,q_auto\/v123\//);
    assert.equal((await completeIdentityUpload(db, env, 'owner', input)).mediaId, saved.mediaId);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()?.n, 1);
  } finally {
    sqlite.close();
  }
});
