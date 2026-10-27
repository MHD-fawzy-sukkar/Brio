'use client';
import { setLocale } from './locale';
import { useLocale } from './use-locale';
export function LanguageSwitch() {
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      lang={locale === 'ar' ? 'en' : 'ar'}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
      </svg>
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
