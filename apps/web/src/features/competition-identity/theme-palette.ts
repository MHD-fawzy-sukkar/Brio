import type { CompetitionIdentity } from './model';

export const THEME_PALETTES = {
  brio: { label: 'Brio', color: '#9f3043', soft: '#fff1f3' },
  ocean: { label: 'أزرق', color: '#0369a1', soft: '#f0f9ff' },
  forest: { label: 'أخضر', color: '#047857', soft: '#ecfdf5' },
  violet: { label: 'بنفسجي', color: '#6d28d9', soft: '#f5f3ff' },
  amber: { label: 'كهرماني', color: '#92400e', soft: '#fffbeb' },
  rose: { label: 'وردي', color: '#be185d', soft: '#fdf2f8' },
  teal: { label: 'فيروزي', color: '#0f766e', soft: '#f0fdfa' },
  cyan: { label: 'سماوي', color: '#0e7490', soft: '#ecfeff' },
  indigo: { label: 'نيلي', color: '#4338ca', soft: '#eef2ff' },
  orange: { label: 'برتقالي', color: '#c2410c', soft: '#fff7ed' },
  slate: { label: 'رمادي', color: '#475569', soft: '#f8fafc' },
  red: { label: 'أحمر', color: '#b91c1c', soft: '#fef2f2' },
} as const;

function luminance(channels: number[]) {
  return channels
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
const hex = (channels: number[]) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

export function accentPalette(accent = 'brio') {
  if (Object.hasOwn(THEME_PALETTES, accent)) {
    const preset = THEME_PALETTES[accent as keyof typeof THEME_PALETTES];
    return {
      ...preset,
      text: preset.color,
      onAccent: '#ffffff',
      hover: `color-mix(in srgb, ${preset.color} 85%, black)`,
    };
  }
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return accentPalette('brio');
  const color = accent.toLowerCase();
  const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  let ink = [...channels];
  while (luminance(ink) > 0.18) ink = ink.map((value) => value * 0.9);
  const light = luminance(channels) > 0.179;
  return {
    label: 'مخصّص',
    color,
    soft: hex(channels.map((value) => value * 0.08 + 255 * 0.92)),
    text: hex(ink),
    onAccent: light ? '#000000' : '#ffffff',
    hover: `color-mix(in srgb, ${color} 96%, ${light ? 'white' : 'black'})`,
  };
}

export function themePalette(identity: CompetitionIdentity) {
  return accentPalette(identity.accent);
}
