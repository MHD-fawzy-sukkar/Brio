import test from 'node:test';
import assert from 'node:assert/strict';
import workerApp from './index';

test('GET /api/health returns 200 OK JSON', async () => {
  const req = new Request('http://localhost:8787/api/health');
  const res = await workerApp.fetch(req, {} as any, {} as any);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type')?.includes('application/json'), true);

  const body = await res.json() as any;
  assert.equal(body.status, 'ok');
  assert.equal(body.version, '1.0.0');
  assert.ok(body.timestamp);
});

test('GET /api/unknown-endpoint returns 404 RFC 7807 JSON (NOT HTML)', async () => {
  const req = new Request('http://localhost:8787/api/unknown-endpoint');
  const res = await workerApp.fetch(req, {} as any, {} as any);

  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type')?.includes('application/json'), true);

  const body = await res.json() as any;
  assert.equal(body.code, 'not_found');
  assert.ok(body.traceId);
  assert.ok(body.detail);
});
