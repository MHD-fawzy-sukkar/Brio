'use client';
import { useTranslations } from '../../i18n/use-locale';
import { backgroundIdentitySaves } from './background-identity-saves';
import type { IdentitySave } from './background-identity-saves';
export function IdentitySaveError({ task }: { task: IdentitySave }) {
  const { t, translateMessage } = useTranslations();
  if (task.state !== 'failed') return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
    >
      <p>{translateMessage(task.error ?? '')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => backgroundIdentitySaves.retry(task.quizId)}
        >
          {t('إعادة المحاولة')}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => backgroundIdentitySaves.dismiss(task.quizId)}
        >
          {t('استخدام هوية Brio الافتراضية')}
        </button>
      </div>
    </div>
  );
}
