import assert from 'node:assert/strict';
import test from 'node:test';
import { assignSpecialImage } from './image-roles';
import type { SaveIdentityRequest } from '@brio/contracts';

test('logo is used only for branding; changing the mascot keeps every other image playable', () => {
  const images: SaveIdentityRequest['images'] = [
    { mediaId: 'a', label: 'Logo', roles: ['avatar', 'character'] },
    { mediaId: 'b', label: 'Character', roles: ['avatar'] },
    { mediaId: 'c', label: 'Player', roles: ['avatar'] }
  ];
  const logo = assignSpecialImage(images, 'logo', 'a');
  assert.deepEqual(logo[0].roles, ['logo']);
  assert.ok(logo.every(image => image.roles.length > 0));
  const character = assignSpecialImage(logo, 'character', 'b');
  assert.deepEqual(character.map(image => image.roles), [['logo'], ['avatar', 'character'], ['avatar']]);
  assert.deepEqual(assignSpecialImage(character, 'logo', '').map(image => image.roles), [['avatar'], ['avatar', 'character'], ['avatar']]);
  assert.deepEqual(assignSpecialImage(character, 'character', 'a')[0].roles, ['avatar', 'character']);
  assert.deepEqual(images[0].roles, ['avatar', 'character']);
});
