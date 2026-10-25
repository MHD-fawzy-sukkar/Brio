import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToHsv, hsvToHex } from './color-space';

test('the embedded picker preserves RGB colors across hue sectors, grayscale and black', () => {
  for (const r of [0, 32, 128, 255]) for (const g of [0, 64, 192, 255]) for (const b of [0, 85, 170, 255]) {
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    const hsv = hexToHsv(hex);
    assert.ok(hsv.h >= 0 && hsv.h < 360 && hsv.s >= 0 && hsv.s <= 1 && hsv.v >= 0 && hsv.v <= 1);
    assert.equal(hsvToHex(hsv), hex);
  }
  assert.equal(hsvToHex({ h: 360, s: 1, v: 1 }), '#ff0000');
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00ff00');
  assert.equal(hsvToHex({ h: 240, s: 1, v: 1 }), '#0000ff');
  assert.equal(hsvToHex({ h: 240, s: 0, v: 1 }), '#ffffff');
  assert.equal(hsvToHex({ h: 240, s: 1, v: 0 }), '#000000');
});
