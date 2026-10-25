import test from 'node:test';
import assert from 'node:assert/strict';
import { CompetitionIdentitySchema, SaveIdentityRequestSchema, createCompetitionIdentity, identityImageSources, mapIdentityImages, isCompetitionAvatarAllowed } from './identity';

const mediaId = '00000000-0000-4000-8000-000000000001';
const source = 'https://res.cloudinary.com/brio/image/upload/v1/example.webp';

test('automatic avatar policy adds Bolt below five and rejects built-ins once five custom avatars exist', () => {
  for (const count of [0, 1, 4, 5, 20]) {
    const identity = CompetitionIdentitySchema.parse({ name: 'Team', character: { kind: 'bolt' }, avatarMode: 'auto',
      avatars: Array.from({ length: count }, (_, i) => ({ id: `identity:00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, label: 'Team', src: source })) });
    assert.equal(isCompetitionAvatarAllowed(identity, 'bolt-avatar-01'), count < 5);
    for (const avatar of identity.avatars) assert.equal(isCompetitionAvatarAllowed(identity, avatar.id), true);
  }
  assert.equal(SaveIdentityRequestSchema.safeParse({ name: 'Logo only', images: [{ mediaId, label: 'Logo', roles: ['logo'] }] }).success, true);
});
test('one image can serve all roles, with a single logo/character and required custom avatar', () => {
  const input = SaveIdentityRequestSchema.parse({ name: 'Team', images: [{ mediaId, label: 'Team', roles: ['logo', 'character', 'avatar'] }], avatarMode: 'custom' });
  assert.equal(SaveIdentityRequestSchema.safeParse({ ...input, images: [] }).success, false);
  assert.equal(SaveIdentityRequestSchema.safeParse({ ...input, images: [...input.images, { ...input.images[0], mediaId: '00000000-0000-4000-8000-000000000002' }] }).success, false);
  assert.equal(SaveIdentityRequestSchema.safeParse({ ...input, images: [{ ...input.images[0], roles: ['logo'] }] }).success, false);
  const identity = createCompetitionIdentity(input, new Map([[mediaId, source]]));
  assert.equal(identity.character.kind, 'image');
  assert.equal(CompetitionIdentitySchema.safeParse({ ...identity, avatars: [] }).success, false);
  assert.equal(CompetitionIdentitySchema.safeParse({ ...identity, avatars: [...identity.avatars, ...identity.avatars] }).success, false);
  assert.deepEqual(identityImageSources(identity), [source]);
  assert.equal(isCompetitionAvatarAllowed(identity, `identity:${mediaId}`), true);
  assert.equal(isCompetitionAvatarAllowed(identity, 'bolt-avatar-01'), false);
  assert.equal(isCompetitionAvatarAllowed({ ...identity, avatarMode: 'mixed' }, 'bolt-avatar-01'), true);
  assert.equal(isCompetitionAvatarAllowed(identity, 'https://attacker.invalid/a.png'), false);
  const mapped = mapIdentityImages(identity, () => '/media/' + 'a'.repeat(64));
  assert.deepEqual(identityImageSources(mapped), ['/media/' + 'a'.repeat(64)]);
  assert.deepEqual(identityImageSources(identity), [source]);
});
