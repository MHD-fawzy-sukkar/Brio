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

test('GET / serves static asset or falls back to index.html', async () => {
  const mockAssets = {
    fetch: async (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === '/index.html') {
        return new Response('<html>Home Page</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('Not Found', { status: 404 });
    }
  };

  const req = new Request('http://localhost:8787/dashboard');
  const res = await workerApp.fetch(req, { ASSETS: mockAssets } as any, {} as any);

  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, '<html>Home Page</html>');
});

