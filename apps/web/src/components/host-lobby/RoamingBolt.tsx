'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BoltMascot } from '../BoltMascot';

type FlightBounds = { height: number; x: number; y: number };

/** The transparent flight area ends at the bottom of the player-list heading. */
export function RoamingBolt() {
  const areaRef = useRef<HTMLDivElement>(null);
  const boltRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<FlightBounds | null>(null);

  useEffect(() => {
    const root = areaRef.current?.closest('[data-bolt-flight-root]');
    const boundary = root?.querySelector('[data-bolt-flight-boundary]');
    if (!root || !boundary || !boltRef.current) return;
    function measure() {
      if (!boltRef.current || !root || !boundary) return;
      const rootRect = root.getBoundingClientRect();
      const boltRect = boltRef.current.getBoundingClientRect();
      const height = Math.max(0, boundary.getBoundingClientRect().bottom - rootRect.top);
      const next = {
        height,
        x: Math.max(0, rootRect.width - boltRect.width - 24),
        y: Math.max(0, height - boltRect.height - 24)
      };
      setBounds(current => current?.height === next.height && current.x === next.x && current.y === next.y ? current : next);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(boundary);
    observer.observe(boltRef.current);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const style = {
    height: bounds?.height ?? 0,
    visibility: bounds ? 'visible' : 'hidden',
    '--wander-x': `${bounds?.x ?? 0}px`,
    '--wander-y': `${bounds?.y ?? 0}px`
  } as CSSProperties;

  return <div ref={areaRef} className="bolt-flight-area" style={style} aria-hidden="true">
    <div ref={boltRef} className="roaming-bolt">
      <div className="animate-wander">
        <BoltMascot faceMode="original" animated={false} pose="flat" className="w-full" />
      </div>
    </div>
  </div>;
}
