'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, type HsvColor } from './color-space';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ColorSpectrum({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const current = useRef(hsv);
  const source = useRef(color);
  useEffect(() => {
    if (source.current === color) return;
    source.current = color;
    const next = hexToHsv(color);
    if (!next.s) next.h = current.current.h;
    current.current = next;
    setHsv(next);
  }, [color]);
  const change = (next: HsvColor) => {
    current.current = next;
    setHsv(next);
    const hex = hsvToHex(next);
    source.current = hex;
    onChange(hex);
  };
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    change({
      ...current.current,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    });
  };
  return (
    <div className="theme-color-spectrum">
      <div
        role="slider"
        tabIndex={0}
        aria-label="درجة اللون وإضاءته"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`تشبّع ${Math.round(hsv.s * 100)}%، إضاءة ${Math.round(hsv.v * 100)}%`}
        className="theme-color-spectrum__plane"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          point(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) point(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const step = event.shiftKey ? 0.1 : 0.01;
          change({
            ...current.current,
            s: clamp(
              current.current.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
            ),
            v: clamp(
              current.current.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
            ),
          });
        }}
      >
        <span
          aria-hidden="true"
          className="theme-color-spectrum__point"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: color }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        step={1}
        value={hsv.h}
        dir="ltr"
        aria-label="طيف اللون"
        className="theme-color-spectrum__hue"
        onChange={(event) => change({ ...current.current, h: Number(event.target.value) })}
      />
    </div>
  );
}
