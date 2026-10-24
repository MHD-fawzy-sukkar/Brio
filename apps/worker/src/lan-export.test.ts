import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index';

test('LAN private export requires an authenticated quiz owner and disables response caching', async () => {
  let owned = true;
  const snapshot = { id: 'quiz', title: 'Private', revision: 1, questions: [{ id: 'secret-question', acceptedAlternatives: ['private answer'] }] };
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) { args = values; return this; },
        async all() { return { results: [] }; },
        async first() {
          if (sql.includes('FROM creator_sessions')) return { id: 'owner' };
          if (sql.includes('FROM quizzes WHERE')) { assert.equal(args[1], 'owner'); return owned ? { id: 'quiz', title: 'Private' } : null; }
          if (sql.includes('FROM quiz_versions')) return { private_snapshot_json: JSON.stringify(snapshot) };
          throw new Error('Unexpected SQL');
        }
      };
    }
  };
  const call = (cookie = '') => worker.fetch(new Request('https://brio.invalid/api/quizzes/quiz/lan-export', { headers: { Cookie: cookie } }), { DB: db } as any, {} as any);
  assert.equal((await call()).status, 401);
  const response = await call('brio_creator_session=owner-session');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json() as any).quiz, snapshot);
  owned = false;
  const denied = await call('brio_creator_session=owner-session');
  assert.equal(denied.status, 404);
  assert.equal((await denied.text()).includes('private answer'), false);
});
