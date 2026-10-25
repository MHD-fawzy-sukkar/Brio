'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { compactFlightPose } from './compact-flight';

export type MascotPose = Readonly<{ yaw: number; pitch: number; bank: number }>;
export type MascotFlightOptions = {
  scope?: 'lobby' | 'page' | 'studio';
  celebration?: boolean;
  dragWithinPage?: boolean;
  compact?: boolean;
  /** Supply a stable callback for optional artwork-specific animation. */
  onPose?: (pose: MascotPose) => void;
};

const MAX_YAW = 0.38;
const MAX_PITCH = 0.14;

/** Artwork-independent flight, pointer capture and animation lifecycle. */
export function useMascotFlight({ scope = 'lobby', celebration = false, dragWithinPage = false, compact = false, onPose }: MascotFlightOptions) {
  const areaRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLDivElement>(null);
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
    anchorX: 40,
    anchorY: 16,
    maxX: 500,
    maxY: 160,
    yaw: 0,
    pitch: 0,
    bank: 0,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    dragVx: 0,
    dragVy: 0,
    initialized: false
  });

  useEffect(() => {
    const root = areaRef.current?.closest('[data-mascot-flight-root]') as HTMLElement | null;
    const boundary = root?.querySelector('[data-mascot-flight-boundary]') as HTMLElement | null;
    if (!root || (scope === 'lobby' && !boundary) || !characterRef.current) return;

    const waypoint = () => {
      const s = stateRef.current;
      s.targetX = 8 + Math.random() * Math.max(0, s.maxX - 8);
      s.targetY = 4 + Math.random() * Math.max(0, s.maxY - 4);
    };

    const measure = () => {
      if (!characterRef.current || !root) return;
      const rootRect = root.getBoundingClientRect();
      const characterW = characterRef.current.offsetWidth || 160;
      const characterH = characterRef.current.offsetHeight || 105;
      const contentBoundary = boundary ? Math.max(0, boundary.getBoundingClientRect().top - rootRect.top) : rootRect.height;
      const flightHeight =
        scope === 'studio'
          ? Math.min(380, Math.max(220, rootRect.height * 0.55))
          : Math.min(220, Math.max(140, contentBoundary || 180));

      const s = stateRef.current;
      s.maxX = Math.max(80, rootRect.width - characterW - 16);
      s.maxY = Math.max(40, flightHeight - characterH - 12);

      if (!s.initialized) {
        s.initialized = true;
        s.x = Math.min(s.maxX, Math.max(16, s.maxX * 0.12));
        s.y = Math.min(s.maxY, 14);
        s.anchorX = s.x;
        s.anchorY = s.y;
        waypoint();
        setReady(true);
      }
      s.anchorX = Math.max(8, Math.min(s.maxX, s.anchorX));
      s.anchorY = Math.max(4, Math.min(s.maxY, s.anchorY));
      characterRef.current.style.transform = `translate3d(${s.anchorX}px, ${s.anchorY}px, 0)`;
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (boundary) observer.observe(boundary);
    observer.observe(characterRef.current);
    window.addEventListener('resize', measure);
    measure();

    let rafId = 0;
    let lastTime = performance.now();
    const speed = scope === 'studio' ? 0.95 : celebration ? 1.15 : 0.85;

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime) / 16.667;
      lastTime = now;
      const s = stateRef.current;

      let yawTarget: number;
      let pitchTarget: number;
      let bankTarget: number;

      if (!s.isDragging && compact) {
        const pose = compactFlightPose(now, s.anchorX, s.anchorY);
        s.x = pose.x;
        s.y = pose.y;
        yawTarget = pose.yaw;
        pitchTarget = pose.pitch;
        bankTarget = pose.bank;
      } else if (!s.isDragging) {
        const dx = s.targetX - s.x, dy = s.targetY - s.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 28) waypoint();
        s.vx += ((dx / Math.max(1, distance)) * speed - s.vx) * 0.022 * dt;
        s.vy += ((dy / Math.max(1, distance)) * speed * 0.75 - s.vy) * 0.022 * dt;
        s.x += s.vx * dt;
        s.y += (s.vy + Math.sin(now * 0.0021) * 0.2) * dt;
        yawTarget = Math.max(-1, Math.min(1, s.vx / speed)) * MAX_YAW + Math.sin(now * 0.0009) * 0.05;
        pitchTarget = Math.max(-1, Math.min(1, s.vy / speed)) * MAX_PITCH + Math.sin(now * 0.0013) * 0.03;
        bankTarget = Math.max(-7, Math.min(7, s.vx * 6));
      } else {
        s.dragVx *= 0.85;
        s.dragVy *= 0.85;
        yawTarget = Math.max(-1, Math.min(1, s.dragVx / 6)) * MAX_YAW;
        pitchTarget = Math.max(-1, Math.min(1, s.dragVy / 6)) * MAX_PITCH;
        bankTarget = Math.max(-10, Math.min(10, s.dragVx * 1.2));
      }

      s.yaw += (yawTarget - s.yaw) * 0.06 * dt;
      s.pitch += (pitchTarget - s.pitch) * 0.06 * dt;
      s.bank += (bankTarget - s.bank) * 0.07 * dt;

      if (characterRef.current && innerRef.current) {
        characterRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
        innerRef.current.style.transform = `perspective(750px) rotateY(${(s.yaw * 24).toFixed(2)}deg) rotateX(${(-s.pitch * 22).toFixed(2)}deg) rotateZ(${s.bank.toFixed(2)}deg)`;
      }

      onPose?.(s);

      rafId = window.requestAnimationFrame(tick);
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      window.cancelAnimationFrame(rafId);
      lastTime = performance.now();
      if (!reducedMotion.matches && !document.hidden) rafId = window.requestAnimationFrame(tick);
    };
    reducedMotion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    updateMotion();
    return () => {
      window.cancelAnimationFrame(rafId);
      reducedMotion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateMotion);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scope, celebration, compact, onPose]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
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
    s.lastPointerY = e.clientY;
    s.dragVx = 0;
    s.dragVy = 0;
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !areaRef.current) return;
    const areaRect = areaRef.current.getBoundingClientRect();
    const root = areaRef.current.closest('[data-mascot-flight-root]') as HTMLElement | null;
    const rootRect = root?.getBoundingClientRect() || areaRect;
    const characterW = characterRef.current?.offsetWidth || 160;
    const characterH = characterRef.current?.offsetHeight || 105;

    const page = dragWithinPage ? areaRef.current.closest('[data-mascot-drag-root]')?.getBoundingClientRect() : null;
    const minX = page ? page.left - areaRect.left : -16;
    const maxX = page ? page.right - areaRect.left - characterW : rootRect.width - characterW + 16;
    const minY = page ? page.top - areaRect.top : -12;
    const maxY = page ? page.bottom - areaRect.top - characterH : Math.max(rootRect.height - characterH, s.maxY + 240);
    s.x = Math.max(minX, Math.min(maxX, e.clientX - areaRect.left - s.dragOffsetX));
    s.y = Math.max(minY, Math.min(maxY, e.clientY - areaRect.top - s.dragOffsetY));

    s.dragVx = s.dragVx * 0.5 + (e.clientX - s.lastPointerX) * 0.5;
    s.dragVy = s.dragVy * 0.5 + (e.clientY - s.lastPointerY) * 0.5;
    s.lastPointerX = e.clientX;
    s.lastPointerY = e.clientY;
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    s.isDragging = false;
    setDragging(false);
    // Resume a tiny hover around the chosen position, without throw momentum.
    s.anchorX = s.x;
    s.anchorY = s.y;
    if (!compact) {
      s.vx = Math.max(-2, Math.min(2, s.dragVx * 0.15));
      s.vy = Math.max(-1.5, Math.min(1.5, s.dragVy * 0.15));
      s.targetX = Math.max(8, Math.min(s.maxX, s.x + (s.vx >= 0 ? 160 : -160)));
      s.targetY = Math.max(4, Math.min(s.maxY, s.y + Math.random() * 80 - 40));
    }
  };

  return { areaRef, characterRef, innerRef, ready, dragging, onPointerDown, onPointerMove, endDrag };
}
