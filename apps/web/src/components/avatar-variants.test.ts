import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarVariant, AVATAR_VARIANT_COUNT, BOLT_AVATARS, resolveAvatarIndex } from './avatar-variants';

test('15 avatars retain distinct hues with upright front-facing artwork', () => {
  const variants = Array.from({ length: AVATAR_VARIANT_COUNT }, (_, index) => avatarVariant(index));
  assert.equal(new Set(variants.map(variant => variant.hue)).size, 15);
  assert.equal(new Set(variants.map(variant => variant.eyeStyle)).size, 8);
  assert.equal(new Set(variants.map(variant => `${variant.hue}:${variant.eyeStyle}`)).size, 15);
});

test('new avatar IDs and saved legacy IDs resolve to the same identity', () => {
  BOLT_AVATARS.forEach((id, index) => {
    assert.equal(resolveAvatarIndex(id), index);
    assert.equal(resolveAvatarIndex(`/avatars/avatar-${index + 1}.svg`), index);
    assert.equal(resolveAvatarIndex(`avatar_${index + 1}`), index);
  });
});

test('invalid IDs and custom image URLs are not treated as built-in avatars', () => {
  ['/avatars/avatar-0.svg', 'bolt-avatar-16', 'avatar_99', '/custom.png'].forEach(id => assert.equal(resolveAvatarIndex(id), null));
});

test('avatar variants remain deterministic and wrap safely for long player lists', () => {
  assert.deepEqual(avatarVariant(15), avatarVariant(0));
  assert.deepEqual(avatarVariant(-1), avatarVariant(14));
  assert.deepEqual(avatarVariant(Number.NaN), avatarVariant(0));
  assert.deepEqual(avatarVariant(4.7), avatarVariant(4));
});
