'use client';

import { useCallback, useId, useRef } from 'react';
import type { MascotPose } from '../../hooks/use-mascot-flight';
import { MascotFlight } from '../MascotFlight';

const BOLT_SRC = '/bolt-original.png';

// Exact superellipse contours and masks measured from the 1536x1024 artwork.
const VISOR_PATH =
  'M 764 298 C 944 298, 1024 338, 1024 482 C 1024 636, 944 665, 764 665 C 584 665, 504 636, 504 482 C 504 338, 584 298, 764 298 Z';
const VISOR_COVER_PATH =
  'M 764 290 C 955 290, 1034 334, 1034 482 C 1034 646, 955 673, 764 673 C 573 673, 494 646, 494 482 C 494 334, 573 290, 764 290 Z';
const VISOR_CX = 764;
const VISOR_CY = 481;
const FACE_CX = 763;
const FACE_CY = 510;
const BODY = { cx: 767, cy: 486, rx: 336, ry: 386 };
const LEFT_HAND = { cx: 365, cy: 725, path: 'M 250 610 L 420 610 L 468 725 L 468 835 L 250 835 Z' };
const RIGHT_HAND = { cx: 1160, cy: 725, path: 'M 1110 610 L 1290 610 L 1290 835 L 1060 835 L 1060 725 Z' };

/** Free-flying spherical mascot with integrated 3D visor & inner LED parallax. */
export function RoamingBolt({
  scope = 'lobby',
  celebration = false,
  dragWithinPage = false,
}: {
  scope?: 'lobby' | 'page' | 'studio';
  celebration?: boolean;
  dragWithinPage?: boolean;
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const visorRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftHandRef = useRef<SVGGElement>(null);
  const rightHandRef = useRef<SVGGElement>(null);
  const specRef = useRef<SVGEllipseElement>(null);
  const onPose = useCallback((s: MascotPose) => {
    const sinYaw = Math.sin(s.yaw);
    const cosYaw = Math.cos(s.yaw);
    const sinPitch = Math.sin(s.pitch);
    const cosPitch = Math.cos(s.pitch);

    // Visor stays integrated within the white faceplate while LED eyes & smile glide deeper inside it.
    if (visorRef.current) {
      const vdx = 42 * sinYaw;
      const vdy = 14 * sinPitch;
      visorRef.current.setAttribute(
        'transform',
        `translate(${(VISOR_CX + vdx).toFixed(1)} ${(VISOR_CY + vdy).toFixed(1)}) scale(${cosYaw.toFixed(3)} ${cosPitch.toFixed(3)}) translate(${-VISOR_CX} ${-VISOR_CY})`,
      );
    }
    if (faceRef.current && leftEyeRef.current && rightEyeRef.current) {
      const fdx = 40 * sinYaw;
      const fdy = 15 * sinPitch;
      const lEyeScaleX = Math.max(0.64, Math.cos(s.yaw - 0.24)) / cosYaw;
      const rEyeScaleX = Math.max(0.64, Math.cos(s.yaw + 0.24)) / cosYaw;
      faceRef.current.setAttribute(
        'transform',
        `translate(${(FACE_CX + fdx).toFixed(1)} ${(FACE_CY + fdy).toFixed(1)}) translate(${-FACE_CX} ${-FACE_CY})`,
      );
      leftEyeRef.current.setAttribute(
        'transform',
        `translate(654 485) scale(${lEyeScaleX.toFixed(3)} 1) translate(-654 -485)`,
      );
      rightEyeRef.current.setAttribute(
        'transform',
        `translate(870 485) scale(${rEyeScaleX.toFixed(3)} 1) translate(-870 -485)`,
      );
    }
    if (leftHandRef.current && rightHandRef.current) {
      const lScale = 1 + 0.12 * sinYaw;
      const rScale = 1 - 0.12 * sinYaw;
      const lDx = 54 * sinYaw + 22 * (1 - cosYaw);
      const rDx = 54 * sinYaw - 22 * (1 - cosYaw);
      leftHandRef.current.setAttribute(
        'transform',
        `translate(${(LEFT_HAND.cx + lDx).toFixed(1)} ${(LEFT_HAND.cy + 14 * sinPitch).toFixed(1)}) scale(${lScale.toFixed(3)}) translate(${-LEFT_HAND.cx} ${-LEFT_HAND.cy})`,
      );
      rightHandRef.current.setAttribute(
        'transform',
        `translate(${(RIGHT_HAND.cx + rDx).toFixed(1)} ${(RIGHT_HAND.cy + 14 * sinPitch).toFixed(1)}) scale(${rScale.toFixed(3)}) translate(${-RIGHT_HAND.cx} ${-RIGHT_HAND.cy})`,
      );
    }
    if (specRef.current) {
      specRef.current.setAttribute('cx', (640 - 140 * sinYaw).toFixed(1));
      specRef.current.setAttribute('cy', (250 - 90 * sinPitch).toFixed(1));
    }
  }, []);

  return (
    <MascotFlight scope={scope} celebration={celebration} dragWithinPage={dragWithinPage} onPose={onPose}>
      <svg viewBox="0 0 1536 1024" className="block h-auto w-full overflow-visible select-none">
        <defs>
          <radialGradient id={`${uid}-cut`}>
            <stop offset="0.72" stopColor="black" />
            <stop offset="1" stopColor="white" />
          </radialGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0.65" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </radialGradient>
          <linearGradient
            id={`${uid}-dome`}
            x1="495"
            y1="440"
            x2="1032"
            y2="520"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f8f4ec" />
            <stop offset="0.22" stopColor="#f5efe1" />
            <stop offset="0.68" stopColor="#dde6e8" />
            <stop offset="0.88" stopColor="#b4cbd9" />
            <stop offset="1" stopColor="#9fb9bd" />
          </linearGradient>
          <linearGradient
            id={`${uid}-visor-patch`}
            x1="600"
            y1="435"
            x2="910"
            y2="560"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#1c222c" />
            <stop offset="0.35" stopColor="#10151d" />
            <stop offset="0.7" stopColor="#0c1016" />
            <stop offset="1" stopColor="#090d11" />
          </linearGradient>
          <radialGradient id={`${uid}-spec`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <mask
            id={`${uid}-nohands`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
            style={{ maskType: 'luminance' }}
          >
            <rect width="1536" height="1024" fill="white" />
            <path d={LEFT_HAND.path} fill="black" />
            <path d={RIGHT_HAND.path} fill="black" />
          </mask>
          <mask
            id={`${uid}-visor-noled`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
            style={{ maskType: 'luminance' }}
          >
            <rect width="1536" height="1024" fill="white" />
            <ellipse cx="654" cy="485" rx="60" ry="54" fill={`url(#${uid}-cut)`} />
            <ellipse cx="870" cy="485" rx="60" ry="54" fill={`url(#${uid}-cut)`} />
            <ellipse cx="763" cy="538" rx="90" ry="48" fill={`url(#${uid}-cut)`} />
          </mask>
          <mask
            id={`${uid}-leye`}
            maskUnits="userSpaceOnUse"
            x="585"
            y="425"
            width="140"
            height="120"
            style={{ maskType: 'luminance' }}
          >
            <ellipse cx="654" cy="485" rx="56" ry="50" fill={`url(#${uid}-glow)`} />
          </mask>
          <mask
            id={`${uid}-reye`}
            maskUnits="userSpaceOnUse"
            x="800"
            y="425"
            width="140"
            height="120"
            style={{ maskType: 'luminance' }}
          >
            <ellipse cx="870" cy="485" rx="56" ry="50" fill={`url(#${uid}-glow)`} />
          </mask>
          <mask
            id={`${uid}-mouth`}
            maskUnits="userSpaceOnUse"
            x="665"
            y="485"
            width="196"
            height="106"
            style={{ maskType: 'luminance' }}
          >
            <ellipse cx="763" cy="538" rx="86" ry="45" fill={`url(#${uid}-glow)`} />
          </mask>
          <clipPath id={`${uid}-visor`} clipPathUnits="userSpaceOnUse">
            <path d={VISOR_PATH} />
          </clipPath>
          <clipPath id={`${uid}-body`} clipPathUnits="userSpaceOnUse">
            <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} />
          </clipPath>
          <clipPath id={`${uid}-lhand`} clipPathUnits="userSpaceOnUse">
            <path d={LEFT_HAND.path} />
          </clipPath>
          <clipPath id={`${uid}-rhand`} clipPathUnits="userSpaceOnUse">
            <path d={RIGHT_HAND.path} />
          </clipPath>
        </defs>

        {/* Base sphere (hands removed so they can orbit independently) */}
        <image href={BOLT_SRC} width="1536" height="1024" mask={`url(#${uid}-nohands)`} />

        {/* Seamless dome match + integrated visor + deeper 3D LED eyes & mouth */}
        <g clipPath={`url(#${uid}-body)`}>
          <path d={VISOR_COVER_PATH} fill={`url(#${uid}-dome)`} />
          <g ref={visorRef}>
            <g clipPath={`url(#${uid}-visor)`}>
              <rect x="580" y="420" width="370" height="180" rx="40" fill={`url(#${uid}-visor-patch)`} />
              <image href={BOLT_SRC} width="1536" height="1024" mask={`url(#${uid}-visor-noled)`} />
              <g ref={faceRef}>
                <g ref={leftEyeRef}>
                  <image href={BOLT_SRC} width="1536" height="1024" mask={`url(#${uid}-leye)`} />
                </g>
                <g ref={rightEyeRef}>
                  <image href={BOLT_SRC} width="1536" height="1024" mask={`url(#${uid}-reye)`} />
                </g>
                <image href={BOLT_SRC} width="1536" height="1024" mask={`url(#${uid}-mouth)`} />
              </g>
            </g>
          </g>
          {/* World-fixed light: highlight drifts as the sphere turns */}
          <ellipse
            ref={specRef}
            cx="640"
            cy="250"
            rx="210"
            ry="140"
            fill={`url(#${uid}-spec)`}
            style={{ mixBlendMode: 'screen' }}
          />
        </g>

        <g ref={leftHandRef}>
          <image href={BOLT_SRC} width="1536" height="1024" clipPath={`url(#${uid}-lhand)`} />
        </g>
        <g ref={rightHandRef}>
          <image href={BOLT_SRC} width="1536" height="1024" clipPath={`url(#${uid}-rhand)`} />
        </g>
      </svg>
    </MascotFlight>
  );
}
