import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPinJoinPath } from './JoinQrCode';

test('builds a QR destination that pre-fills the six-digit game PIN',()=>{
  assert.equal(buildPinJoinPath('123456'),'/join/?pin=123456');
});
