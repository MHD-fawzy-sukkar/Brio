'use client';

import { useEffect, useId, useState } from 'react';
import type { avatarVariant } from '../features/avatars/catalog';

const AVATAR_BASE_SRC = '/avatars/bolt-base-v2.png';
let avatarBaseReady = false;
let avatarBasePromise: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

function ensureAvatarBaseLoaded(): void {
  if (avatarBaseReady || typeof window === 'undefined') return;
  if (avatarBasePromise) return;

  avatarBasePromise = new Promise<void>((resolve) => {
    const img = new window.Image();
    img.decoding = 'sync';
    const done = () => {
      avatarBaseReady = true;
      for (const listener of readyListeners) listener();
      readyListeners.clear();
      resolve();
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = AVATAR_BASE_SRC;
    if (img.complete) {
      done();
    }
  });
}

if (typeof window !== 'undefined') {
  ensureAvatarBaseLoaded();
}

/** One native coordinate system for the bitmap, eye erasure, and replacement LEDs. */
export function BoltAvatarArtwork({ variant }: { variant: ReturnType<typeof avatarVariant> }) {
  const id = useId();
  const { eyeStyle, hue } = variant;
  const [ready, setReady] = useState(avatarBaseReady);

  useEffect(() => {
    if (avatarBaseReady) {
      setReady(true);
      return;
    }
    const onReady = () => setReady(true);
    readyListeners.add(onReady);
    ensureAvatarBaseLoaded();
    return () => {
      readyListeners.delete(onReady);
    };
  }, []);

  return (
    <svg
      className={`bolt-avatar-artwork transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'}`}
      viewBox="0 0 1536 1024"
      aria-hidden="true"
      data-eye-style={eyeStyle}
      data-hue={hue}
    >
      <defs>
        <radialGradient id={`${id}-cut`}>
          <stop offset="0.82" stopColor="black" />
          <stop offset="1" stopColor="white" />
        </radialGradient>
        <mask
          id={`${id}-eyes`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1536"
          height="1024"
          style={{ maskType: 'luminance' }}
        >
          <rect width="1536" height="1024" fill="white" />
          {[654, 870].map((x) => (
            <ellipse key={x} cx={x} cy="485" rx="58" ry="52" fill={`url(#${id}-cut)`} />
          ))}
        </mask>
      </defs>
      {ready && [654, 870].map((x) => <ellipse key={x} cx={x} cy="485" rx="59" ry="53" fill="#0d171e" />)}
      <image
        href={AVATAR_BASE_SRC}
        width="1536"
        height="1024"
        mask={`url(#${id}-eyes)`}
        style={{ filter: `hue-rotate(${hue}deg)` }}
        onLoad={() => {
          avatarBaseReady = true;
          setReady(true);
        }}
      />
      {ready &&
        [654, 870].map((x, index) => (
          <g key={x} className="bolt-avatar-led" transform={`translate(${x} 485)`}>
            {eyeStyle === 'round' && <ellipse className="bolt-avatar-led__solid" rx="25" ry="29" />}
            {eyeStyle === 'wink' &&
              (index === 0 ? (
                <ellipse className="bolt-avatar-led__solid" rx="24" ry="29" />
              ) : (
                <path d="M-28 8 Q0 -22 28 8" />
              ))}
            {eyeStyle === 'joyful' && <path d="M-29 9 Q0 -34 29 9" />}
            {eyeStyle === 'sparkle' && (
              <path
                className="bolt-avatar-led__solid"
                d="M0 -34 10 -10 34 0 10 10 0 34 -10 10 -34 0 -10 -10Z"
              />
            )}
            {eyeStyle === 'heart' && (
              <path
                className="bolt-avatar-led__solid"
                d="M0 29 -26 3 C-48 -24 -10 -43 0 -21 C10 -43 48 -24 26 3Z"
              />
            )}
            {eyeStyle === 'curious' && (
              <ellipse
                className="bolt-avatar-led__solid"
                rx={index === 0 ? 18 : 27}
                ry={index === 0 ? 23 : 33}
              />
            )}
            {eyeStyle === 'sleepy' && <path d="M-28 -5 Q0 22 28 -5" />}
            {eyeStyle === 'focused' && (
              <path d={index === 0 ? 'M-28 -16 26 8 -23 18' : 'M28 -16 -26 8 23 18'} />
            )}
          </g>
        ))}
    </svg>
  );
}
