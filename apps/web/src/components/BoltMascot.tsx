export type MascotExpression = 'idle' | 'waiting' | 'happy' | 'sad';

type MascotFaceProps = {
  expression?: MascotExpression;
  isTalking?: boolean;
};

type BoltMascotProps = MascotFaceProps & {
  className?: string;
  hueRotate?: number;
  label?: string;
  animated?: boolean;
};

const starPath = 'M34 24 38.5 34.5 50 35.5 41 43 44 54 34 48 24 54 27 43 18 35.5 29.5 34.5Z';

/** SVG-only face art. It intentionally lives outside the filtered body image. */
export function MascotFace({ expression = 'idle', isTalking = false }: MascotFaceProps) {
  return <svg className="mascot-face" viewBox="0 0 160 110" aria-hidden="true">
    <g className="mascot-face__eyes">
      {(expression === 'idle' || expression === 'waiting') && <>
        <circle className="mascot-face__led" cx="35" cy="40" r="7" />
        <circle className="mascot-face__led" cx="125" cy="40" r="7" />
      </>}
      {expression === 'happy' && <>
        <path className="mascot-face__led" d={starPath} />
        <path className="mascot-face__led" d={starPath} transform="translate(92 0)" />
      </>}
      {expression === 'sad' && <>
        <path className="mascot-face__stroke" d="M18 39 Q34 53 51 43" />
        <path className="mascot-face__stroke" d="M109 43 Q126 53 142 39" />
      </>}
    </g>

    <g className={`mascot-face__mouth${isTalking ? ' mascot-face__mouth--talking' : ''}`}>
      {expression === 'idle' && <path className="mascot-face__stroke" d="M58 72 Q80 91 102 72" />}
      {expression === 'waiting' && <path className="mascot-face__stroke" d="M63 79 H97" />}
      {expression === 'happy' && <path className="mascot-face__stroke mascot-face__stroke--wide" d="M45 68 Q80 102 115 68" />}
      {expression === 'sad' && <path className="mascot-face__stroke" d="M56 90 Q80 65 104 90" />}
    </g>
  </svg>;
}

/**
 * One bitmap body plus two independent face layers: an opaque visor cover and
 * an SVG expression. Keeping them as siblings prevents body hue shifts from
 * changing the LED colour.
 */
export function BoltMascot({
  expression = 'idle',
  isTalking = false,
  className = 'w-64',
  hueRotate = 0,
  label = '',
  animated = true
}: BoltMascotProps) {
  const normalizedHue = ((hueRotate % 360) + 360) % 360;

  return <span
    className={`bolt-mascot ${className}`}
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : true}
  >
    <span className={`bolt-mascot__stage${animated ? ' animate-float' : ''}`}>
      <img
        src="/bolt-original.png"
        alt=""
        draggable={false}
        className="bolt-mascot__body"
        style={{ filter: `hue-rotate(${normalizedHue}deg)` }}
      />
      <span className="bolt-mascot__visor-cover" aria-hidden="true" />
      <span className="bolt-mascot__face-layer">
        <MascotFace expression={expression} isTalking={isTalking} />
      </span>
    </span>
  </span>;
}
