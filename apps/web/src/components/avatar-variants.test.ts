import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarVariant, AVATAR_VARIANT_COUNT } from './avatar-variants';

test('15 avatars retain distinct hues with upright front-facing artwork', () => {
  const variants = Array.from({ length: AVATAR_VARIANT_COUNT }, (_, index) => avatarVariant(index));
  assert.equal(new Set(variants.map(variant => variant.hue)).size, 15);
  assert.equal(new Set(variants.map(variant => variant.eyeStyle)).size, 5);
  assert.ok(variants.every(variant => variant.direction === 1 && variant.tilt === 0));
});

test('avatar variants remain deterministic and wrap safely for long player lists', () => {
  assert.deepEqual(avatarVariant(15), avatarVariant(0));
  assert.deepEqual(avatarVariant(-1), avatarVariant(14));
  assert.deepEqual(avatarVariant(Number.NaN), avatarVariant(0));
  assert.deepEqual(avatarVariant(4.7), avatarVariant(4));
});
