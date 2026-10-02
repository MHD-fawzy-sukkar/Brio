import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartLobby, playerCountLabel } from './lobby-model';

test('host lobby requires a connection and at least one player', () => {
  const player = { id: 'p1', nickname: 'ليان' };
  assert.equal(canStartLobby(false, [player]), false);
  assert.equal(canStartLobby(true, []), false);
  assert.equal(canStartLobby(true, [player]), true);
});

test('host lobby exposes natural Arabic player counts', () => {
  assert.equal(playerCountLabel(0), 'لا يوجد لاعبون بعد');
  assert.equal(playerCountLabel(1), 'لاعب واحد جاهز');
  assert.equal(playerCountLabel(2), 'لاعبان جاهزان');
  assert.match(playerCountLabel(5), /5|٥/);
});
