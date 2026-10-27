import test from 'node:test';
import assert from 'node:assert/strict';
import type { IdentityRecordDto, SaveIdentityRequest } from '@brio/contracts';
import { BackgroundIdentitySaves } from './background-identity-saves';
import { peekResource, setResource } from '../../services/resource-cache';
const input = { name: 'Team', images: [], visibility: 'private' } as unknown as SaveIdentityRequest;
const record = {
  ...input,
  id: 'saved-theme',
  identity: { name: 'Team', character: { kind: 'bolt' }, avatars: [] },
} as unknown as IdentityRecordDto;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('creation can navigate while identity preparation runs; completion preserves cached questions and title', async (t) => {
  const upload = deferred<SaveIdentityRequest>();
  let saves = 0,
    disposed = 0;
  const manager = new BackgroundIdentitySaves(async () => {
    saves++;
    return record;
  });
  t.after(() => manager.close());
  manager.enqueue('new-quiz', 'Team', {
    prepare: () => upload.promise,
    dispose: () => {
      disposed++;
    },
  });
  assert.equal(manager.get('new-quiz')?.state, 'saving');
  assert.equal(saves, 0);
  assert.equal(manager.unfinished(), true);
  setResource('/api/quizzes/new-quiz', {
    id: 'new-quiz',
    title: 'Edited while uploading',
    questions: [{ id: 'q2' }, { id: 'q1' }],
    identity_id: null,
  });
  upload.resolve(input);
  await manager.wait('new-quiz');
  assert.equal(saves, 1);
  assert.equal(disposed, 1);
  assert.equal(manager.unfinished(), false);
  assert.deepEqual(peekResource('/api/quizzes/new-quiz'), {
    id: 'new-quiz',
    title: 'Edited while uploading',
    questions: [{ id: 'q2' }, { id: 'q1' }],
    identity_id: 'saved-theme',
  });
});

test('failed saves retain staged files for retry, and gameplay waits for a successful identity save', async (t) => {
  let saves = 0,
    disposed = 0;
  const manager = new BackgroundIdentitySaves(async () => {
    if (++saves === 1) throw Error('Temporary failure');
    return record;
  });
  t.after(() => manager.close());
  manager.enqueue('retry', 'Team', {
    prepare: async () => input,
    dispose: () => {
      disposed++;
    },
  });
  await assert.rejects(manager.wait('retry'), /Temporary failure/);
  assert.equal(disposed, 0);
  assert.equal(manager.get('retry')?.state, 'failed');
  manager.retry('retry');
  await manager.wait('retry');
  assert.equal(disposed, 1);
  assert.equal(saves, 2);
});

test('account changes abort pending work and cannot attach another account staged images', async (t) => {
  let scope = 1,
    saves = 0,
    disposed = 0;
  let signal!: AbortSignal;
  const upload = deferred<SaveIdentityRequest>();
  const manager = new BackgroundIdentitySaves(
    async () => {
      saves++;
      return record;
    },
    () => scope,
  );
  t.after(() => manager.close());
  manager.enqueue('private', 'Team', {
    prepare: (abort) => {
      signal = abort;
      return upload.promise;
    },
    dispose: () => {
      disposed++;
    },
  });
  scope = 2;
  setResource('/api/quizzes/scope-event', {});
  assert.equal(signal.aborted, true);
  assert.equal(manager.get('private'), undefined);
  upload.resolve(input);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(saves, 0);
  assert.equal(disposed, 1);
});
