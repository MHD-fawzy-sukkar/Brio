import type { CSSProperties } from 'react';
import { BoltAvatarArtwork } from './BoltAvatarArtwork';
import { avatarVariant, BOLT_AVATARS, resolveAvatarIndex } from './avatar-variants';

export { BOLT_AVATARS };

type AvatarProps = {
  src: string;
  label?: string;
  className?: string;
  playerIndex?: number;
  presentation?: 'tile' | 'hero';
};

export function Avatar({ src, label = '', className = 'h-12 w-12', playerIndex, presentation = 'tile' }: AvatarProps) {
  const index = resolveAvatarIndex(src);
  if (src && index === null) return <img src={src} alt={label} decoding="async" className={className} />;
  const variant = avatarVariant(index ?? playerIndex ?? 0);
  return <span className={`avatar${presentation === 'hero' ? ' avatar--hero' : ''} ${className}`} style={{ '--avatar-glow': variant.glow } as CSSProperties} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
    <span className="avatar__art">
      <span className={`avatar__canvas${presentation === 'hero' ? ' animate-float' : ''}`}>
        <BoltAvatarArtwork variant={variant} />
      </span>
    </span>
  </span>;
}
