'use client';

import { useTranslations } from '../../i18n/use-locale';

import { Avatar } from '../../components/Avatar';
import { useCompetitionIdentity } from './CompetitionIdentityProvider';
import { identityAvatars } from './model';
import { themePalette } from './theme-palette';
import type { CSSProperties } from 'react';

export function AvatarPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslations();
  const identity = useCompetitionIdentity();
  const palette = themePalette(identity);
  return (
    <fieldset>
      <legend className="label">{t('اختر صورتك')}</legend>
      <div
        className={
          compact ? 'grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3' : 'grid grid-cols-3 gap-3 sm:grid-cols-5'
        }
      >
        {identityAvatars(identity).map((avatar, index) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onChange(avatar.id)}
            aria-label={
              avatar.id.startsWith('bolt-avatar-') ? t('الصورة {0}', { 0: index + 1 }) : avatar.label
            }
            aria-pressed={value === avatar.id}
            className="avatar-choice"
            style={
              {
                '--theme-accent': palette.color,
                '--theme-soft': palette.soft,
                '--theme-on-accent': palette.onAccent,
              } as CSSProperties
            }
          >
            <Avatar src={avatar.id} playerIndex={index} className="w-full rounded-xl" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
