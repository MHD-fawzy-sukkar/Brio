import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_COMPETITION_IDENTITY, identityAvatars, resolveAvatarSource, selectedAvatar, type CompetitionIdentity } from './model';

const custom: CompetitionIdentity = {
  name: 'Volunteer team',
  character: { kind: 'image', src: '/team/character.png', label: 'Team character', motion: 'float' },
  avatars: [{ id: 'team:bird', src: '/team/bird.png', label: 'Bird' }]
};

test('the main character is the default avatar and changing the selection preserves the chosen source', () => {
  const identity: CompetitionIdentity = { ...custom, character: { kind: 'image', src: '/team/main.png', label: 'Main', motion: 'float' },
    avatars: [...custom.avatars, { id: 'team:main', src: '/team/main.png', label: 'Main' }] };
  assert.equal(selectedAvatar(identity, ''), 'team:main');
  assert.equal(selectedAvatar(identity, 'team:bird'), 'team:bird');
  assert.equal(resolveAvatarSource(identity, selectedAvatar(identity, 'team:bird')), '/team/bird.png');
});

test('automatic picker matches the server threshold and repairs a hidden Bolt selection', () => {
  for (const count of [0, 1, 4, 5, 20]) {
    const identity: CompetitionIdentity = { ...custom, avatarMode: 'auto', avatars: Array.from({ length: count }, (_, i) => ({ ...custom.avatars[0], id: `team:${i}` })) };
    const choices = identityAvatars(identity);
    assert.equal(choices.length, count + (count < 5 ? 15 : 0));
    assert.equal(choices.some(avatar => avatar.id === 'bolt-avatar-01'), count < 5);
    if (count >= 5) assert.equal(selectedAvatar(identity, 'bolt-avatar-01'), 'team:0');
  }
});

test('competition avatar IDs resolve within their own identity without changing saved Brio players', () => {
  assert.equal(resolveAvatarSource(custom, 'team:bird'), '/team/bird.png');
  assert.equal(resolveAvatarSource(custom, 'bolt-avatar-01'), 'bolt-avatar-01');
  assert.equal(resolveAvatarSource(custom, '/avatars/avatar-1.svg'), '/avatars/avatar-1.svg');
  assert.equal(resolveAvatarSource(custom, '/saved/image.png'), '/saved/image.png');
  const other = { ...custom, avatars: [{ ...custom.avatars[0], src: '/other/bird.png' }] };
  assert.equal(resolveAvatarSource(other, 'team:bird'), '/other/bird.png');
  assert.equal(resolveAvatarSource(custom, 'team:bird'), '/team/bird.png');
});

test('switching identities or removing an avatar repairs the join selection', () => {
  assert.equal(selectedAvatar(custom, 'bolt-avatar-01'), 'team:bird');
  assert.equal(selectedAvatar(custom, 'team:bird'), 'team:bird');
  assert.equal(selectedAvatar(DEFAULT_COMPETITION_IDENTITY, 'team:bird'), 'bolt-avatar-01');
  const empty = { ...custom, avatars: [] };
  assert.equal(identityAvatars(empty).length, 15);
  assert.equal(selectedAvatar(empty, 'team:bird'), 'bolt-avatar-01');
});

test('avatar modes expose Brio choices, custom choices or both while preserving stable custom IDs', () => {
  const mixed = { ...custom, avatarMode: 'mixed' as const };
  assert.equal(identityAvatars(mixed).length, 16);
  assert.equal(selectedAvatar(mixed, 'bolt-avatar-01'), 'bolt-avatar-01');
  assert.equal(resolveAvatarSource(mixed, 'team:bird'), '/team/bird.png');
  assert.equal(identityAvatars({ ...custom, avatarMode: 'brio' }).length, 15);
  assert.equal(identityAvatars({ ...custom, avatarMode: 'custom' }).length, 1);
});
