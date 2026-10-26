import assert from 'node:assert/strict';
import test from 'node:test';
import { accentPalette, THEME_PALETTES } from './theme-palette';

function lightness(hex: string) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a: string, b: string) =>
  (Math.max(lightness(a), lightness(b)) + 0.05) / (Math.min(lightness(a), lightness(b)) + 0.05);

test('custom colors keep exact artwork accents while text stays readable on buttons and light surfaces', () => {
  for (const red of [0, 85, 170, 255])
    for (const green of [0, 85, 170, 255])
      for (const blue of [0, 85, 170, 255]) {
        const color = '#' + [red, green, blue].map((c) => c.toString(16).padStart(2, '0')).join('');
        const palette = accentPalette(color);
        assert.equal(palette.color, color);
        assert.ok(contrast(palette.color, palette.onAccent) >= 4.5, color);
        assert.ok(contrast(palette.text, '#ffffff') >= 4.5, color);
        assert.match(palette.soft, /^#[0-9a-f]{6}$/);
      }
  assert.equal(accentPalette('#ABCDEF').color, '#abcdef');
  assert.deepEqual(accentPalette('invalid'), accentPalette('brio'));
  for (const [key, preset] of Object.entries(THEME_PALETTES))
    assert.equal(accentPalette(key).color, preset.color);
});
