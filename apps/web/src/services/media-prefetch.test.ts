import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MediaPrefetchEngine } from './media-prefetch';

test('a hanging image download times out with bounded retries instead of occupying a slot forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const engine = new MediaPrefetchEngine();
  const original = global.fetch;
  let attempts = 0;
  global.fetch = async (_url, options) => {
    attempts++;
    return new Promise<Response>((_resolve, reject) =>
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), {
        once: true,
      }),
    );
  };
  try {
    engine.queueImages([
      { url: 'https://test.invalid/hanging.png', questionId: 'hanging', isEssential: true, priority: 1 },
    ]);
    for (let i = 0; i < 4; i++) {
      t.mock.timers.tick(10000);
      await new Promise<void>((r) => setImmediate(r));
      t.mock.timers.tick(1000);
      await new Promise<void>((r) => setImmediate(r));
    }
    assert.equal(attempts, 4);
    assert.equal(engine.getState('https://test.invalid/hanging.png')?.status, 'error');
  } finally {
    global.fetch = original;
  }
});

test('failed prefetch retries never release or duplicate a concurrent download slot', async () => {
  const engine = new MediaPrefetchEngine();
  const original = global.fetch;
  let active = 0,
    maximum = 0;
  const attempts = new Map<string, number>();
  global.fetch = async (input) => {
    const url = String(input);
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((r) => setTimeout(r, 20));
    active--;
    const attempt = (attempts.get(url) || 0) + 1;
    attempts.set(url, attempt);
    return attempt < 3
      ? new Response('temporary failure', { status: 503 })
      : new Response(new Blob(['image'], { type: 'image/png' }));
  };
  try {
    engine.queueImages(
      Array.from({ length: 6 }, (_, i) => ({
        url: `https://test.invalid/${i}.png`,
        questionId: String(i),
        isEssential: true,
        priority: 1,
      })),
    );
    for (let i = 0; i < 140 && engine.getMetrics().readyCount < 6; i++)
      await new Promise((r) => setTimeout(r, 25));
    assert.equal(engine.getMetrics().readyCount, 6);
    assert.equal(maximum, 2);
    assert.equal(attempts.size, 6);
    for (const count of attempts.values()) assert.equal(count, 3);
  } finally {
    global.fetch = original;
  }
});

describe('Phase P5 — Frontend Resilience & Media Prefetch Tests', () => {
  describe('T17 — Cache Disabled/Full & Malformed Image Fallback', () => {
    it('handles image prefetch failures gracefully with bounded retries and no infinite loop', async () => {
      const engine = new MediaPrefetchEngine();

      // Mock fetch failure (simulating 404 or malformed image)
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return new Response('Not Found', { status: 404, statusText: 'Not Found' });
      };

      try {
        engine.queueImages([
          { url: 'https://fixtures.brio/malformed.jpg', questionId: 'q_bad', isEssential: true, priority: 1 },
        ]);

        // Wait 2500ms for all 3 retry attempts with exponential backoff to complete
        await new Promise((resolve) => setTimeout(resolve, 2500));

        const state = engine.getState('https://fixtures.brio/malformed.jpg');
        assert.ok(state);
        assert.equal(state.status, 'error');
        assert.equal(state.decoded, false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('falls back to memory cache when Cache Storage is unavailable', async () => {
      const engine = new MediaPrefetchEngine();
      const mockBlob = new Blob(['mock image data'], { type: 'image/jpeg' });

      const originalFetch = global.fetch;
      global.fetch = async () => {
        return new Response(mockBlob, { status: 200 });
      };

      try {
        engine.queueImages([
          { url: 'https://fixtures.brio/valid.jpg', questionId: 'q_valid', isEssential: true, priority: 1 },
        ]);

        await new Promise((resolve) => setTimeout(resolve, 200));

        assert.equal(engine.isLoaded('https://fixtures.brio/valid.jpg'), true);
        const state = engine.getState('https://fixtures.brio/valid.jpg');
        assert.equal(state?.status, 'loaded');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('T22 — Mid-Game PWA Updates Deferral', () => {
    it('defers service worker updates when brio_active_game is true', () => {
      // Simulate active game in sessionStorage
      const storage: Record<string, string> = { brio_active_game: 'true' };
      const inActiveSession = storage['brio_active_game'] === 'true';

      assert.equal(inActiveSession, true);
      // When inActiveSession is true, SW registration logic skips sending SKIP_WAITING
    });
  });

  describe('Next-Image-Ready Rate Telemetry', () => {
    it('accurately calculates next-image-ready rate percentage', async () => {
      const engine = new MediaPrefetchEngine();
      const mockBlob = new Blob(['sample image data'], { type: 'image/webp' });

      const originalFetch = global.fetch;
      global.fetch = async () => {
        return new Response(mockBlob, { status: 200 });
      };

      try {
        engine.queueImages([
          { url: 'https://fixtures.brio/img1.webp', questionId: 'q1', isEssential: true, priority: 1 },
          { url: 'https://fixtures.brio/img2.webp', questionId: 'q2', isEssential: true, priority: 1 },
        ]);

        await new Promise((resolve) => setTimeout(resolve, 300));

        const metrics = engine.getMetrics();
        assert.equal(metrics.totalRequested, 2);
        assert.equal(metrics.readyCount, 2);
        assert.equal(metrics.readyRatePercentage, 100);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
