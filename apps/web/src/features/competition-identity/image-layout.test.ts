import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIdentityImage, visibleBounds } from './image-layout';

test('portrait and landscape artwork fit the same square without distortion or clipping', () => {
  for (const [width, height] of [
    [1200, 300],
    [200, 900],
    [500, 500],
  ]) {
    const fitted = fitIdentityImage(width, height);
    assert.ok(Math.abs(fitted.width / fitted.height - width / height) < 0.00001);
    assert.ok(fitted.x > 0 && fitted.y > 0);
    assert.ok(fitted.x + fitted.width <= 640 && fitted.y + fitted.height <= 640);
    assert.equal(Math.max(fitted.width, fitted.height), 640 * 0.86);
  }
});

test('transparent padding is trimmed, opaque backgrounds are retained and empty images rejected', () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  assert.equal(visibleBounds(pixels, 10, 10), null);
  pixels[(4 * 10 + 5) * 4 + 3] = 255;
  assert.deepEqual(visibleBounds(pixels, 10, 10), { x: 4, y: 3, width: 3, height: 3 });
  pixels.fill(255);
  assert.deepEqual(visibleBounds(pixels, 10, 10), { x: 0, y: 0, width: 10, height: 10 });
});
