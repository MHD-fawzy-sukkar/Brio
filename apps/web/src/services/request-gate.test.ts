import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestGate } from './request-gate';

test('100 immediate clicks start one request; pending requests and rapid retries stay blocked', () => {
  let now = 1000;
  const gate = new RequestGate(1000, () => now);
  assert.equal(Array.from({ length: 100 }, () => gate.start()).filter(Boolean).length, 1);
  now += 5000;
  assert.equal(gate.start(), false);
  gate.finish();
  assert.equal(gate.start(), true);
  gate.finish();
  assert.equal(gate.start(), false);
  now += 999;
  assert.equal(gate.start(), false);
  now++;
  assert.equal(gate.start(), true);
});
