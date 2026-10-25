import test from 'node:test';
import assert from 'node:assert/strict';
import { runUploadBatch } from './upload-batch';

test('multi-image batches cap concurrency at two and retain successful images when a file fails', async () => {
  let active = 0, peak = 0;
  const outcomes = new Map<number, boolean>();
  const started: number[] = [];
  await runUploadBatch([1, 2, 3, 4, 5], async item => {
    active++; peak = Math.max(peak, active); started.push(item);
    await new Promise(resolve => setTimeout(resolve, 3));
    active--;
    if (item === 2) throw new Error('One invalid file');
    return item;
  }, (item, result) => outcomes.set(item, result.ok));
  assert.equal(peak, 2);
  assert.deepEqual(started, [1, 2, 3, 4, 5]);
  assert.deepEqual([...outcomes].filter(([, ok]) => ok).map(([item]) => item), [1, 3, 4, 5]);
  assert.equal(outcomes.get(2), false);
});

test('retrying a failed image runs only that image and empty selections start no requests', async () => {
  const sent: string[] = [];
  await runUploadBatch([], async item => sent.push(String(item)), () => {});
  await runUploadBatch(['retry.png'], async item => { sent.push(item); return 'asset'; }, (_, result) => assert.equal(result.ok, true));
  assert.deepEqual(sent, ['retry.png']);
});
