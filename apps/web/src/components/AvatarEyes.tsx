import { useId } from 'react';

export const AVATAR_EYE_STYLES = ['original', 'wink', 'joyful', 'curious', 'sparkle'] as const;
export type AvatarEyeStyle = typeof AVATAR_EYE_STYLES[number];

/** Replace just the two LEDs at native bitmap coordinates, preserving the visor and smile. */
export function AvatarEyes({ style }: { style: AvatarEyeStyle }) {
  const id = useId();
  if (style === 'original') return null;
  return <svg className="avatar-eyes" viewBox="0 0 1536 1024" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-eye-cover`}>
        <stop offset="0" stopColor="#0d171e" />
        <stop offset=".72" stopColor="#0d171e" />
        <stop offset="1" stopColor="#0d171e" stopOpacity="0" />
      </radialGradient>
    </defs>
    {[654, 870].map((x, index) => <g key={x}>
      <ellipse cx={x} cy="485" rx="49" ry="49" fill={`url(#${id}-eye-cover)`} />
      <g className="avatar-eyes__led" transform={`translate(${x} 485)`}>
        {style === 'wink' && (index === 0 ? <circle r="18" /> : <path d="M-23 8 Q0 -17 23 8" />)}
        {style === 'joyful' && <path d="M-23 9 Q0 -26 23 9" />}
        {style === 'curious' && <ellipse rx={index === 0 ? 17 : 24} ry={index === 0 ? 23 : 29} />}
        {style === 'sparkle' && <path className="avatar-eyes__filled" d="M0 -30 8 -9 29 0 8 9 0 30 -8 9 -29 0 -8 -9Z" />}
      </g>
    </g>)}
  </svg>;
}
