'use client';

import { Avatar } from '../../components/Avatar';
import { useCompetitionIdentity } from './CompetitionIdentityProvider';
import { identityAvatars } from './model';
import { themePalette } from './theme-palette';
import type { CSSProperties } from 'react';

export function AvatarPicker({ value, onChange, compact = false }: { value: string; onChange: (id: string) => void; compact?: boolean }) {
  const identity = useCompetitionIdentity();
  const palette = themePalette(identity);
  return <fieldset>
    <legend className="label">اختر صورتك</legend>
    <div className={compact ? 'grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3' : 'grid grid-cols-3 gap-3 sm:grid-cols-5'}>
      {identityAvatars(identity).map((avatar, index) => <button
        key={avatar.id}
        type="button"
        onClick={() => onChange(avatar.id)}
        aria-label={avatar.label}
        aria-pressed={value === avatar.id}
        className="avatar-choice"
        style={{ '--theme-accent': palette.color, '--theme-soft': palette.soft } as CSSProperties}
      ><Avatar src={avatar.id} playerIndex={index} className="w-full rounded-xl" /></button>)}
    </div>
  </fieldset>;
}
