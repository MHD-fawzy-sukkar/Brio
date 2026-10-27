'use client';

import { useTranslations } from '../../i18n/use-locale';

import { useCompetitionIdentity } from './CompetitionIdentityProvider';
import { DEFAULT_COMPETITION_IDENTITY } from './model';
import { themePalette } from './theme-palette';

export function CompetitionIdentityBadge() {
  const { t } = useTranslations();
  const identity = useCompetitionIdentity();
  const palette = themePalette(identity);
  if (identity === DEFAULT_COMPETITION_IDENTITY) return null;
  return (
    <header
      aria-label={t('هوية المسابقة')}
      className={`competition-brand relative z-10 rounded-2xl border ${identity.logo ? '' : 'competition-brand--text'}`}
      style={{ borderColor: palette.color, background: `linear-gradient(120deg, ${palette.soft}, white)` }}
    >
      {identity.logo && (
        <div className="competition-brand__logo">
          <img src={identity.logo.src} alt={identity.logo.label} />
        </div>
      )}
      <div className="competition-brand__copy">
        <p className="text-xs font-bold" style={{ color: palette.text }}>
          {t('مسابقة بهوية')}
        </p>
        <p className="competition-brand__name">{identity.name}</p>
        <p className="mt-1 text-[11px] text-slate-500">{t('مدعوم من Brio')}</p>
      </div>
    </header>
  );
}
