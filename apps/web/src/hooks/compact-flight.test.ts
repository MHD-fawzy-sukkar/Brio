import test from 'node:test';
import assert from 'node:assert/strict';
import { compactFlightPose } from './compact-flight';

test('autonomous motion stays within 6px horizontally and 3px vertically for long sessions', () => {
  for (let time = 0; time < 3_600_000; time += 97) {
    const pose = compactFlightPose(time, 100, 20);
    assert.ok(Math.abs(pose.x - 100) <= 6);
    assert.ok(Math.abs(pose.y - 20) <= 3);
    assert.ok(Math.abs(pose.bank) <= 1.2);
  }
});
