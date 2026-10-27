'use client';
import { useTranslations } from '../../i18n/use-locale';
export function SubmittedAnswer() {
  const { t } = useTranslations();
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start shadow-sm"
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"
      >
        ✓
      </span>
      <div>
        <p className="text-sm font-bold text-slate-800">{t('تم تسجيل إجابتك')}</p>
        <p className="mt-0.5 text-xs text-slate-500">{t('بانتظار انتهاء الوقت.')}</p>
      </div>
    </div>
  );
}
