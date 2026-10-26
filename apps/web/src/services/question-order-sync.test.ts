import assert from 'node:assert/strict';
import test from 'node:test';
import { questionOrderSync } from './question-order-sync';
import { peekResource, setCacheOwner, setResource } from './resource-cache';
test('navigation reuses its queue and changing accounts cannot send a former account queued write', async () => {
  const oldFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async () => {
    writes++;
    return Response.json({ success: true });
  };
  try {
    setCacheOwner('queue-alice');
    const alice = questionOrderSync('q');
    assert.equal(questionOrderSync('q'), alice);
    setCacheOwner('queue-bob');
    const bob = questionOrderSync('q');
    assert.notEqual(bob, alice);
    alice.enqueue(['b', 'a']);
    await assert.rejects(alice.flush(), /جلسة الحساب/);
    assert.equal(writes, 0);
    bob.enqueue(['a', 'b']);
    await bob.flush();
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = oldFetch;
    setCacheOwner(null);
  }
});
test('acknowledging the last order repairs a stale detail snapshot without losing other fields', async () => {
  const oldFetch = globalThis.fetch;
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  globalThis.fetch = async () => {
    await gate;
    return Response.json({ success: true });
  };
  try {
    setCacheOwner('queue-media');
    setResource('/api/quizzes/media', { id: 'media', questions: [{ id: 'a' }, { id: 'b' }] });
    const queue = questionOrderSync('media');
    queue.enqueue(['b', 'a']);
    setResource('/api/quizzes/media', {
      id: 'media',
      title: 'Latest title',
      questions: [{ id: 'a', media_url: 'new-image' }, { id: 'b' }],
    });
    release();
    await queue.flush();
    const cached = peekResource<{ title: string; questions: { id: string; media_url?: string }[] }>(
      '/api/quizzes/media',
    )!;
    assert.deepEqual(
      cached.questions.map((q) => q.id),
      ['b', 'a'],
    );
    assert.equal(cached.title, 'Latest title');
    assert.equal(cached.questions[1].media_url, 'new-image');
  } finally {
    globalThis.fetch = oldFetch;
    setCacheOwner(null);
  }
});
