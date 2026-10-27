import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadRoutes } from './routes/downloads';

const sha256 = 'a'.repeat(64);
const manifest = {
  filename: 'Brio-LAN-Setup.exe',
  sha256,
  size: 6,
  parts: [
    { path: `/downloads/windows/${sha256.slice(0, 16)}/part-0.bin`, size: 3 },
    { path: `/downloads/windows/${sha256.slice(0, 16)}/part-1.bin`, size: 3 },
  ],
};
function env(missing = false, value = manifest) {
  return {
    ASSETS: {
      async fetch(request: Request) {
        const path = new URL(request.url).pathname;
        if (path.endsWith('manifest.json')) return Response.json(value);
        if (missing && path.endsWith('part-1.bin')) return new Response('missing', { status: 404 });
        return new Response(path.endsWith('part-0.bin') ? 'MZ1' : '234');
      },
    },
  } as any;
}
test('Windows installer streams static release parts as one exact attachment', async () => {
  const response = await downloadRoutes.request('/api/downloads/windows', {}, env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="Brio-LAN-Setup.exe"');
  assert.equal(response.headers.get('Content-Length'), '6');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), 'MZ1234');
});
test('download fails closed if a part is missing or its manifest has unexpected paths', async () => {
  assert.equal((await downloadRoutes.request('/api/downloads/windows', {}, env(true))).status, 503);
  const invalid = { ...manifest, parts: [{ path: 'https://evil.invalid/file', size: 6 }] };
  assert.equal((await downloadRoutes.request('/api/downloads/windows', {}, env(false, invalid))).status, 503);
});
