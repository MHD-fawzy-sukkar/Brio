import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateBundle } from './bundle';
import { LocalStore } from './store';
import type { CompetitionIdentity } from '@brio/contracts';
import { png, fixtureBundle } from './testing/fixtures';
test('bundle import validates version, missing media, checksum, question rules and raster signatures', () => {
  const valid = fixtureBundle();
  const parsed = validateBundle(valid);
  assert.match(parsed.quiz.questions[0].essentialImage!, /^\/media\/[a-f0-9]{64}$/);
  assert.throws(() => validateBundle({ ...valid, version: 2 }));
  assert.throws(() => validateBundle({ ...valid, media: [] }));
  const corrupt = structuredClone(valid);
  corrupt.media[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateBundle(corrupt));
  const invalid = structuredClone(valid);
  invalid.quiz.questions[0].options[1].isCorrect = true;
  assert.throws(() => validateBundle(invalid));
  const disguised = structuredClone(valid),
    bytes = Buffer.from('<svg onload="alert(1)"></svg>');
  disguised.media[0].base64 = bytes.toString('base64');
  disguised.media[0].sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.throws(() => validateBundle(disguised));
});

test('identity assets are required, rewritten and retained by frozen LAN rooms until the last reference is deleted', () => {
  const bundle = fixtureBundle();
  const imageUrl = 'https://res.cloudinary.com/brio/image/upload/v1/identity.png';
  const assetId = '00000000-0000-4000-8000-000000000001';
  const bytes = Buffer.concat([png, Buffer.from([0])]);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const identity: CompetitionIdentity = {
    name: 'Team',
    accent: '#abcdef',
    logo: { src: imageUrl, label: 'Team' },
    character: { kind: 'image', src: imageUrl, label: 'Team', motion: 'float' },
    avatars: [{ id: `identity:${assetId}`, src: imageUrl, label: 'Team' }],
    avatarMode: 'custom',
  };
  const input = {
    ...bundle,
    quiz: { ...bundle.quiz, identity },
    media: [
      bundle.media[0],
      {
        sourceUrl: imageUrl,
        contentType: 'image/png',
        sha256: hash,
        base64: bytes.toString('base64'),
      },
    ],
  };
  const parsed = validateBundle(input);
  assert.equal(parsed.quiz.identity?.accent, '#abcdef');
  assert.equal(parsed.quiz.identity?.logo?.src, `/media/${hash}`);
  assert.equal(parsed.quiz.identity?.avatars[0].src, `/media/${hash}`);
  assert.throws(() => validateBundle({ ...input, media: [bundle.media[0]] }), /Missing identity image/);
  const store = new LocalStore(':memory:');
  try {
    store.importBundle(input);
    const room = store.createRoom('quiz');
    assert.equal(room.quiz.identity?.name, 'Team');
    store.importBundle({ ...input, quiz: { ...input.quiz, identity: { ...identity, name: 'Changed' } } });
    assert.equal(store.load(room.id)?.quiz.identity?.name, 'Team');
    store.deleteQuiz('quiz');
    assert.ok(store.db.prepare('SELECT hash FROM media WHERE hash=?').get(hash));
    store.deleteRoom(room.id);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM media').get()?.n, 0);
  } finally {
    store.close();
  }
});
