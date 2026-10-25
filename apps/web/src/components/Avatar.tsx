'use client';

import type { CSSProperties } from 'react';
import { useCompetitionIdentity } from '../features/competition-identity/CompetitionIdentityProvider';
import { resolveAvatarSource } from '../features/competition-identity/model';
import { BoltAvatarArtwork } from './BoltAvatarArtwork';
import { avatarVariant, resolveAvatarIndex } from '../features/avatars/catalog';


type AvatarProps = {
  src: string;
  label?: string;
  className?: string;
  playerIndex?: number;
  presentation?: 'tile' | 'hero';
};

export function Avatar({ src, label = '', className = 'h-12 w-12', playerIndex, presentation = 'tile' }: AvatarProps) {
  const identity = useCompetitionIdentity();
  const source = resolveAvatarSource(identity, src);
  const index = resolveAvatarIndex(source);
  if (source && index === null) return <span
    className={`avatar${presentation === 'hero' ? ' avatar--hero' : ''} ${className}`}
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : true}
  ><img src={source} alt="" decoding="async" className="h-full w-full object-contain" /></span>;
  const variant = avatarVariant(index ?? playerIndex ?? 0);
  return <span className={`avatar${presentation === 'hero' ? ' avatar--hero' : ''} ${className}`} style={{ '--avatar-glow': variant.glow } as CSSProperties} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
    <span className="avatar__art">
      <span className={`avatar__canvas${presentation === 'hero' ? ' animate-float' : ''}`}>
        <BoltAvatarArtwork variant={variant} />
      </span>
    </span>
  </span>;
}
