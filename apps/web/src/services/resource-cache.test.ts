import test from 'node:test';
import assert from 'node:assert/strict';
import {
  invalidateResources,
  invalidateQuizResources,
  loadResource,
  peekResource,
  resourceIsFresh,
  setCacheOwner,
  setResource,
  subscribeResources,
} from './resource-cache';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test('optimistic values defeat older reads and quiz writes notify only the changed resources', async () => {
  setCacheOwner('targeted');
  setResource('/api/quizzes', []);
  setResource('/api/quizzes/a', { id: 'a', questions: [] });
  setResource('/api/quizzes/b', { id: 'b', questions: [] });
  const stale = deferred<string[]>();
  const request = loadResource('/api/themes', () => stale.promise);
  setResource('/api/themes', ['optimistic']);
  stale.resolve(['old server']);
  await request;
  assert.deepEqual(peekResource('/api/themes'), ['optimistic']);
  let a = 0,
    b = 0;
  const unsubA = subscribeResources(() => a++, '/api/quizzes/a'),
    unsubB = subscribeResources(() => b++, '/api/quizzes/b');
  invalidateQuizResources('a');
  assert.equal(a, 1);
  assert.equal(b, 0);
  assert.equal(resourceIsFresh('/api/quizzes/b'), true);
  unsubA();
  unsubB();
});
test('creator reads deduplicate requests and reuse fresh data on navigation', async () => {
  setCacheOwner('cache-dedupe');
  const task = deferred<string[]>();
  let calls = 0;
  const fetcher = () => {
    calls++;
    return task.promise;
  };
  const first = loadResource('/api/themes', fetcher);
  const second = loadResource('/api/themes', fetcher);
  assert.equal(calls, 1);
  task.resolve(['team']);
  assert.deepEqual(await first, ['team']);
  assert.deepEqual(await second, ['team']);
  assert.deepEqual(await loadResource('/api/themes', fetcher), ['team']);
  assert.equal(calls, 1);
});
test('logout or account changes clear private cached data and reject late writes from a former session', async () => {
  setCacheOwner('alice');
  setResource('/api/identities', ['private']);
  const task = deferred<string[]>();
  const pending = loadResource('/api/quizzes', () => task.promise);
  setCacheOwner('bob');
  task.resolve(['alice quiz']);
  await pending;
  assert.equal(peekResource('/api/identities'), undefined);
  assert.equal(peekResource('/api/quizzes'), undefined);
  setResource('/api/themes', ['bob theme']);
  setCacheOwner(null);
  assert.equal(peekResource('/api/themes'), undefined);
});
test('mutations preserve visible stale data but cannot let an older response overwrite the refreshed value', async () => {
  setCacheOwner('mutation');
  setResource('/api/themes', ['old']);
  invalidateResources(['/api/themes']);
  assert.deepEqual(peekResource('/api/themes'), ['old']);
  assert.equal(resourceIsFresh('/api/themes'), false);
  const old = deferred<string[]>();
  const first = loadResource('/api/themes', () => old.promise);
  invalidateResources(['/api/themes']);
  await loadResource('/api/themes', async () => ['new']);
  old.resolve(['outdated']);
  await first;
  assert.deepEqual(peekResource('/api/themes'), ['new']);
});
test('a failed request releases its slot and invalidation does not discard unrelated in-flight data', async () => {
  setCacheOwner('failure');
  await assert.rejects(
    loadResource('/api/themes', async () => {
      throw new Error('offline');
    }),
  );
  const other = deferred<string[]>();
  const pending = loadResource('/api/quizzes', () => other.promise);
  invalidateResources(['/api/themes']);
  other.resolve(['quiz']);
  await pending;
  assert.deepEqual(peekResource('/api/quizzes'), ['quiz']);
  assert.deepEqual(await loadResource('/api/themes', async () => ['recovered']), ['recovered']);
});

test('session snapshots restore only for the same owner; blocked storage leaves memory caching functional', () => {
  const storage = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });
  try {
    setCacheOwner('persist-a');
    setResource('/api/themes', ['saved']);
    setResource('/api/creator/stats', { totalParticipations: 17, pending: false });
    const snapshot = storage.get('brio_creator_resources_v2')!;
    setCacheOwner('persist-b');
    storage.set('brio_creator_resources_v2', snapshot);
    setCacheOwner('persist-a');
    assert.deepEqual(peekResource('/api/themes'), ['saved']);
    assert.deepEqual(peekResource('/api/creator/stats'), { totalParticipations: 17, pending: false });
    setResource('/api/quizzes', [{ id: 'recent' }]);
    setResource('/api/quizzes/dirty', { id: 'dirty', questions: [] }, { transient: true });
    const retained = JSON.parse(storage.get('brio_creator_resources_v2')!);
    assert.equal(
      retained.entries.some(([key]: [string, unknown]) => key === '/api/quizzes/dirty'),
      false,
    );
    for (const [key, entry] of retained.entries) if (key === '/api/quizzes') entry.at = Date.now() - 180_000;
    setCacheOwner('persist-b');
    storage.set('brio_creator_resources_v2', JSON.stringify(retained));
    setCacheOwner('persist-a');
    assert.deepEqual(peekResource('/api/quizzes'), [{ id: 'recent' }]);
    assert.equal(resourceIsFresh('/api/quizzes'), false);
    setCacheOwner('persist-b');
    assert.equal(peekResource('/api/themes'), undefined);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get sessionStorage() {
          throw new Error('blocked');
        },
      },
    });
    setCacheOwner('storage-blocked');
    setResource('/api/themes', ['still works']);
    assert.deepEqual(peekResource('/api/themes'), ['still works']);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    setCacheOwner(null);
  }
});
