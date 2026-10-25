import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from './http-json';

test('an HTML success response cannot masquerade as an empty JSON identity list', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('<html>Old site</html>', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /خدمة الموقع/);
});

test('JSON transport distinguishes server failure, malformed JSON and a valid empty record', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ detail: 'تخصيص الهوية يحتاج تحديث قاعدة بيانات الموقع.' }, { status: 503 });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /قاعدة بيانات/);
  globalThis.fetch = async () => new Response('{', { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(requestJson('/api/quizzes/q/identity'), /رد غير مكتمل/);
  globalThis.fetch = async () => Response.json({ record: null });
  assert.deepEqual(await requestJson('/api/quizzes/q/identity'), { record: null });
});
