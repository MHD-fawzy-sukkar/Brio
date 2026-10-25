export type ImageBounds = { x: number; y: number; width: number; height: number };

/** Ignore transparent padding, retaining even faint visible edges. */
export function visibleBounds(pixels: Uint8ClampedArray, width: number, height: number): ImageBounds | null {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return null;
  // One sample pixel of breathing room prevents clipping antialiased edges.
  left = Math.max(0, left - 1); top = Math.max(0, top - 1);
  right = Math.min(width - 1, right + 1); bottom = Math.min(height - 1, bottom + 1);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function fitIdentityImage(width: number, height: number, size = 640): ImageBounds {
  const scale = size * 0.86 / Math.max(width, height);
  const fittedWidth = width * scale, fittedHeight = height * scale;
  return { x: (size - fittedWidth) / 2, y: (size - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}
