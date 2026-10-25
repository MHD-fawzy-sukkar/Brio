export type HsvColor = { h: number; s: number; v: number };

export function hexToHsv(hex: string): HsvColor {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = !delta ? 0 : max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const chroma = v * s, hue = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(hue % 2 - 1)), m = v - chroma;
  const rgb = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x]
    : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + rgb.map(c => Math.round((c + m) * 255).toString(16).padStart(2, '0')).join('');
}
