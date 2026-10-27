'use client';

import { useTranslations } from '../../i18n/use-locale';
export function SubmittedAnswer() {
  const { t } = useTranslations();
  return (
    <div
      role="status"
      aria-live="polite"
      className="answer-confirmation mx-auto flex w-fit items-center gap-2.5 rounded-full border border-indigo-200 bg-gradient-to-l from-indigo-50 via-white to-violet-50 px-5 py-2.5 text-sm font-black text-indigo-900 shadow-md shadow-indigo-100/80"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-xs text-white shadow-xs">
        🔒
      </span>
      <span>{t('تم تثبيت إجابتك! بانتظار انتهاء الوقت لإظهار النتيجة…')}</span>
      <span className="h-2 w-2 animate-ping rounded-full bg-indigo-500" />
    </div>
  );
}
