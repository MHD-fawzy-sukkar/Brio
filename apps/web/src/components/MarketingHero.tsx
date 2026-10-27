'use client';

import { t } from '../i18n/locale';
import { useTranslations } from '../i18n/use-locale';
import { BoltMascot } from './BoltMascot';

type MarketingHeroProps = {
  context: 'join' | 'login';
};

const copy = {
  join: {
    get eyebrow() {
      return t('مسابقات حية في الوقت الحقيقي');
    },
    get description() {
      return t('أدخل الرمز، اختر شخصيتك، وابدأ التحدي. نقاط تراكمية وترتيب مباشر ونهاية تستحق الاحتفال.');
    },
    highlights: ['⚡ دخول فوري', '🏆 ترتيب حي', '🎨 تجربة مبهجة'],
  },
  login: {
    get eyebrow() {
      return t('اصنع لحظتك مع جمهورك');
    },
    get description() {
      return t('أنشئ مسابقتك، شارك رمز الدخول، وتابع الحماس والنتائج لحظة بلحظة من لوحة واحدة.');
    },
    highlights: ['✦ إنشاء بسيط', '📊 نتائج مباشرة', '🔒 دخول آمن'],
  },
} as const;

export function MarketingHero({ context }: MarketingHeroProps) {
  const { t, translateMessage } = useTranslations();
  const content = copy[context];
  return (
    <aside className="relative flex h-full flex-col justify-center overflow-hidden px-2 py-7 sm:px-6 sm:py-10 lg:min-h-[34rem] lg:px-10">
      <div className="relative">
        <div className={`mascot-hero mx-auto mb-5 ${context === 'login' ? 'max-w-[19rem]' : ''}`}>
          <BoltMascot label="Bolt" className="w-full" facing="left" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800 shadow-sm">
          {t('تجربة حماسية 🤩')}
        </span>
        <p className="mt-6 text-xs font-black text-brand-600">{translateMessage(content.eyebrow)}</p>
        <h2 className="mt-3 bg-gradient-to-l from-brand-800 via-brand-500 to-amber-500 bg-clip-text text-4xl font-black leading-[1.35] text-transparent sm:text-5xl">
          {t('حوّل كل سؤال')}
          <br />
          {t('إلى لحظة حماس.')}
        </h2>
        <p className="mt-5 max-w-xl text-sm font-semibold leading-8 text-slate-600 sm:text-base">
          {translateMessage(content.description)}
        </p>
        <ul className="mt-7 flex flex-wrap gap-3" aria-label={t('مزايا Brio')}>
          {content.highlights.map((item) => (
            <li
              key={t(item)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"
            >
              {t(item)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
