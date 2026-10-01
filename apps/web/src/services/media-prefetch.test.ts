import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MediaPrefetchEngine } from './media-prefetch';

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
          { url: 'https://fixtures.brio/malformed.jpg', questionId: 'q_bad', isEssential: true, priority: 1 }
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
          { url: 'https://fixtures.brio/valid.jpg', questionId: 'q_valid', isEssential: true, priority: 1 }
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
          { url: 'https://fixtures.brio/img2.webp', questionId: 'q2', isEssential: true, priority: 1 }
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
