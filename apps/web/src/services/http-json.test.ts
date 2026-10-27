import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from './http-json';
import { peekResource, resourceIsFresh, setResource } from './resource-cache';

test('an HTML success response cannot masquerade as an empty JSON identity list', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    new Response('<html>Old site</html>', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /خدمة الموقع/);
});

test('JSON transport distinguishes server failure, malformed JSON and a valid empty record', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    Response.json({ detail: 'تخصيص الهوية يحتاج تحديث قاعدة بيانات الموقع.' }, { status: 503 });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /قاعدة بيانات/);
  globalThis.fetch = async () => new Response('{', { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /رد غير مكتمل/);
  globalThis.fetch = async () => Response.json({ record: null });
  assert.deepEqual(await requestJson('/api/quizzes/q/identity'), { record: null });
});

test('publishing a quiz cannot reshuffle or refetch the visible authoring list during game navigation', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const quizzes = [{ id: 'second' }, { id: 'first' }];
  setResource('/api/quizzes', quizzes);
  setResource('/api/quizzes/first', { id: 'first' });
  globalThis.fetch = async () => Response.json({ status: 'published' });
  await requestJson('/api/quizzes/first/publish', { method: 'POST' });
  assert.equal(resourceIsFresh('/api/quizzes'), true);
  assert.deepEqual(peekResource('/api/quizzes'), quizzes);
  assert.equal(resourceIsFresh('/api/quizzes/first'), true);
});
