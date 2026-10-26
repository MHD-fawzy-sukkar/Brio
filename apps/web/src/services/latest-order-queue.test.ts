import assert from 'node:assert/strict';
import test from 'node:test';
import { LatestOrderQueue } from './latest-order-queue';
const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('rapid moves remain immediate, serialize writes, and coalesce to the last order', async () => {
  const first = deferred(),
    calls: string[][] = [],
    states: ReturnType<LatestOrderQueue['snapshot']>[] = [];
  let active = 0,
    maxActive = 0;
  const queue = new LatestOrderQueue(async (ids) => {
    calls.push(ids);
    active++;
    maxActive = Math.max(maxActive, active);
    if (calls.length === 1) await first.promise;
    active--;
  });
  queue.subscribe(() => states.push(queue.snapshot()));
  queue.enqueue(['b', 'a', 'c']);
  queue.enqueue(['b', 'c', 'a']);
  queue.enqueue(['c', 'b', 'a']);
  assert.deepEqual(queue.snapshot().order, ['c', 'b', 'a']);
  assert.equal(queue.snapshot().saving, true);
  assert.equal(calls.length, 1);
  first.resolve();
  await queue.flush();
  assert.deepEqual(calls, [
    ['b', 'a', 'c'],
    ['c', 'b', 'a'],
  ]);
  assert.equal(maxActive, 1);
  assert.deepEqual(
    states.filter((state) => !state.saving).map((state) => state.order),
    [['c', 'b', 'a']],
  );
});
test('failure of an obsolete request cannot roll back newer moves; failed last order stays available to retry', async () => {
  const first = deferred();
  let count = 0,
    failLatest = true;
  const queue = new LatestOrderQueue(async () => {
    if (++count === 1) await first.promise;
    else if (failLatest) throw new Error('offline');
  });
  queue.enqueue(['b', 'a']);
  queue.enqueue(['a', 'b']);
  first.reject(new Error('old failure'));
  await assert.rejects(queue.flush(), /offline/);
  assert.deepEqual(queue.snapshot().order, ['a', 'b']);
  assert.equal(queue.snapshot().saving, false);
  failLatest = false;
  await queue.flush();
  assert.equal(queue.snapshot().error, '');
  assert.equal(count, 3);
});
