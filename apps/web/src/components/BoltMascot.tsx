type BoltMascotProps = {
  className?: string;
  label?: string;
  animated?: boolean;
  pose?: 'floating' | 'flat';
};

/** The roaming mascot always keeps its original face and colors. */
export function BoltMascot({ className = 'w-64', label = '', animated = true, pose = 'floating' }: BoltMascotProps) {
  return <span className={`bolt-mascot ${className}`} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
    <span className={`bolt-mascot__stage${animated ? ' animate-float' : ''}`}>
      <span className={`bolt-mascot__pose bolt-mascot__pose--${pose}`}>
        <img src="/bolt-original.png" alt="" draggable={false} className="bolt-mascot__body" />
      </span>
    </span>
  </span>;
}
