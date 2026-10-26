import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanBundle, type LanExportSource } from './lan-export';

const src = (id: string) => `https://res.cloudinary.com/brio/image/upload/v1/${id}.png`;
const source: LanExportSource = {
  format: 'brio-lan',
  version: 1,
  quiz: {
    questions: [{ essentialImage: src('question') }],
    identity: {
      name: 'Offline team',
      accent: 'forest',
      character: { kind: 'image', src: src('mascot'), label: 'Mascot', motion: 'float' },
      logo: { src: src('logo'), label: 'Logo' },
      avatarMode: 'auto',
      avatars: [{ id: 'identity:00000000-0000-4000-8000-000000000001', src: src('mascot'), label: 'Player' }],
    },
  },
};

test('LAN download embeds every unique theme/question image with checksums and only two downloads in flight', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let active = 0,
    peak = 0;
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  };
  const blob = await createLanBundle(source, () => {});
  const bundle = JSON.parse(await blob.text());
  assert.equal(peak, 2);
  assert.equal(calls.length, 3);
  assert.equal(bundle.media.length, 3);
  assert.equal(bundle.quiz.identity.accent, 'forest');
  for (const media of bundle.media) assert.match(media.sha256, /^[a-f0-9]{64}$/);
});

test('failed, oversized or HTML image responses abort LAN packaging instead of returning an incomplete file', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(
    createLanBundle(source, () => {}),
    /تعذّر تنزيل/,
  );
  globalThis.fetch = async () =>
    new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(
    createLanBundle(source, () => {}),
    /تعذّر تنزيل/,
  );
  globalThis.fetch = async () =>
    new Response(new Uint8Array(500 * 1024 + 1), { headers: { 'content-type': 'image/png' } });
  await assert.rejects(
    createLanBundle(source, () => {}),
    /500/,
  );
});
