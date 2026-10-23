'use client';

import { useEffect, useRef, useState } from 'react';
import { BoltMascot } from '../BoltMascot';

/** Free-flying 3D mascot with Y-axis perspective and interactive grab-and-drag. */
export function RoamingBolt({ scope = 'lobby', celebration = false }: { scope?: 'lobby' | 'page' | 'studio'; celebration?: boolean }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const boltRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);

  const stateRef = useRef({
    x: 40,
    y: 16,
    vx: 0.55,
    vy: 0.28,
    targetX: 220,
    targetY: 60,
    maxX: 500,
    maxY: 160,
    rotY: -26,
    rotZ: -2,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    lastPointerX: 0,
    initialized: false
  });

  useEffect(() => {
    const root = areaRef.current?.closest('[data-bolt-flight-root]') as HTMLElement | null;
    const boundary = root?.querySelector('[data-bolt-flight-boundary]') as HTMLElement | null;
    if (!root || (scope === 'lobby' && !boundary) || !boltRef.current) return;

    const pickNextWaypoint = (maxX: number, maxY: number, currentX: number, currentY: number) => {
      const spanX = Math.max(120, maxX);
      const spanY = Math.max(50, maxY);
      let nextX = Math.random() * spanX;
      if (Math.abs(nextX - currentX) < spanX * 0.25) {
        nextX = (currentX + spanX * (0.35 + Math.random() * 0.4)) % spanX;
      }
      const nextY = Math.random() * spanY;
      return {
        targetX: Math.max(8, Math.min(spanX, nextX)),
        targetY: Math.max(4, Math.min(spanY, nextY))
      };
    };

    const measure = () => {
      if (!boltRef.current || !root) return;
      const rootRect = root.getBoundingClientRect();
      const boltRect = boltRef.current.getBoundingClientRect();
      const boltW = boltRect.width || 160;
      const boltH = boltRect.height || 105;
      const contentBoundary = boundary ? Math.max(0, boundary.getBoundingClientRect().top - rootRect.top) : rootRect.height;

      const flightHeight =
        scope === 'studio'
          ? Math.min(380, Math.max(220, rootRect.height * 0.55))
          : Math.min(220, Math.max(140, contentBoundary || 180));

      const maxX = Math.max(80, rootRect.width - boltW - 16);
      const maxY = Math.max(40, flightHeight - boltH - 12);

      const s = stateRef.current;
      s.maxX = maxX;
      s.maxY = maxY;

      if (!s.initialized) {
        s.initialized = true;
        s.x = Math.min(maxX, Math.max(16, maxX * 0.12));
        s.y = Math.min(maxY, 14);
        const wp = pickNextWaypoint(maxX, maxY, s.x, s.y);
        s.targetX = wp.targetX;
        s.targetY = wp.targetY;
        setReady(true);
      }
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (boundary) observer.observe(boundary);
    observer.observe(boltRef.current);
    window.addEventListener('resize', measure);
    measure();

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime) / 16.667;
      lastTime = now;
      const s = stateRef.current;

      if (!s.isDragging) {
        const dx = s.targetX - s.x;
        const dy = s.targetY - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 28) {
          const wp = pickNextWaypoint(s.maxX, s.maxY, s.x, s.y);
          s.targetX = wp.targetX;
          s.targetY = wp.targetY;
        }

        const speed = scope === 'studio' ? 0.95 : celebration ? 1.15 : 0.85;
        const desiredVx = (dx / Math.max(1, dist)) * speed;
        const desiredVy = (dy / Math.max(1, dist)) * (speed * 0.75);

        s.vx += (desiredVx - s.vx) * 0.025 * dt;
        s.vy += (desiredVy - s.vy) * 0.025 * dt;

        s.x += s.vx * dt;
        s.y += (s.vy + Math.sin(now * 0.0022) * 0.22) * dt;

        // Emphasize 3D Y-axis rotation so one side of the character appears clearly angled in 3D
        const baseSideAngle = s.vx >= 0 ? -28 : 28;
        const subtleWave = Math.sin(now * 0.0018) * 6;
        const targetRotY = baseSideAngle + subtleWave;
        const targetRotZ = Math.max(-6, Math.min(6, s.vx * 3.2 + Math.cos(now * 0.002) * 2));

        s.rotY += (targetRotY - s.rotY) * 0.05 * dt;
        s.rotZ += (targetRotZ - s.rotZ) * 0.06 * dt;
      }

      if (boltRef.current && innerRef.current) {
        boltRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
        innerRef.current.style.transform = `perspective(620px) rotateY(${s.rotY.toFixed(1)}deg) rotateZ(${s.rotZ.toFixed(1)}deg)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scope, celebration]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!areaRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const areaRect = areaRef.current.getBoundingClientRect();
    const s = stateRef.current;
    s.isDragging = true;
    s.dragOffsetX = e.clientX - areaRect.left - s.x;
    s.dragOffsetY = e.clientY - areaRect.top - s.y;
    s.lastPointerX = e.clientX;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !areaRef.current) return;
    const areaRect = areaRef.current.getBoundingClientRect();
    const root = areaRef.current.closest('[data-bolt-flight-root]') as HTMLElement | null;
    const rootRect = root?.getBoundingClientRect() || areaRect;
    const boltW = boltRef.current?.offsetWidth || 160;
    const boltH = boltRef.current?.offsetHeight || 105;

    const nextX = e.clientX - areaRect.left - s.dragOffsetX;
    const nextY = e.clientY - areaRect.top - s.dragOffsetY;

    s.x = Math.max(-16, Math.min(rootRect.width - boltW + 16, nextX));
    s.y = Math.max(-12, Math.min(Math.max(rootRect.height - boltH, s.maxY + 240), nextY));

    const deltaX = e.clientX - s.lastPointerX;
    s.lastPointerX = e.clientX;
    const dragTiltY = Math.max(-38, Math.min(38, deltaX !== 0 ? (deltaX > 0 ? -30 : 30) : s.rotY));
    s.rotY += (dragTiltY - s.rotY) * 0.25;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    s.isDragging = false;
    setDragging(false);
    // Continue flying smoothly from the exact dropped location
    const spanX = Math.max(120, s.maxX);
    const spanY = Math.max(60, Math.max(s.maxY, s.y + 40));
    s.targetX = Math.max(12, Math.min(spanX, s.x + (Math.random() > 0.5 ? 140 : -140)));
    s.targetY = Math.max(8, Math.min(spanY, Math.max(10, s.y + (Math.random() * 80 - 40))));
  };

  return (
    <div
      ref={areaRef}
      className="bolt-flight-area"
      style={{ visibility: ready ? 'visible' : 'hidden' }}
      aria-hidden="true"
    >
      <div
        ref={boltRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="اسحب لتحريك الشخصية"
        className={`roaming-bolt${scope === 'studio' ? ' roaming-bolt--studio' : ''} ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div ref={innerRef} className="roaming-bolt__3d">
          <BoltMascot animated={false} pose="flat" className="w-full" />
        </div>
      </div>
    </div>
  );
}
