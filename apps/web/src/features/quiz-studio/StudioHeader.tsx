'use client';

import { useTranslations } from '../../i18n/use-locale';
import Link from 'next/link';
import type { StudioController } from './use-quiz-studio';
import type { QuizDetail } from './model';
export function StudioHeader({
  studio,
}: {
  studio: Pick<
    StudioController,
    | 'quiz'
    | 'identitySaving'
    | 'reordering'
    | 'starting'
    | 'downloadingLan'
    | 'downloadProgress'
    | 'downloadNotice'
    | 'startGame'
    | 'downloadForLan'
  >;
}) {
  const { t, translateMessage } = useTranslations();
  const {
    quiz,
    identitySaving,
    reordering,
    starting,
    downloadingLan,
    downloadProgress,
    downloadNotice,
    startGame,
    downloadForLan,
  } = studio;
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-3xl font-black text-slate-900">{t('استوديو المسابقة')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('عدّل معلومات المسابقة وهويتها، وأضف الأسئلة من هنا.')}
        </p>
      </div>
      <div className="studio-actions">
        <Link
          href="/dashboard/"
          className="secondary-btn inline-flex items-center justify-center gap-2 border-brand-200/90 bg-white px-5 py-3 text-sm font-black text-brand-700 shadow-2xs transition hover:border-brand-300 hover:bg-brand-50/70"
        >
          <span aria-hidden="true" className="inline-block ltr:rotate-180">
            →
          </span>
          <span>{t('مسابقاتي')}</span>
        </Link>
        <div className="studio-download">
          <button
            onClick={downloadForLan}
            disabled={starting || downloadingLan || identitySaving || !quiz?.questions.length}
            className="secondary-btn w-full px-5 py-3"
            aria-busy={downloadingLan}
          >
            {downloadingLan ? t('جاري التنزيل…') : t('↓ تنزيل للّعب المحلي')}
          </button>
          <div
            role="status"
            aria-live="polite"
            className="studio-download__status text-xs leading-5 text-slate-600"
          >
            {translateMessage((downloadingLan ? downloadProgress : downloadNotice) ?? '')}
          </div>
        </div>
        <button
          onClick={startGame}
          disabled={starting || downloadingLan || identitySaving || !quiz?.questions.length}
          className="primary-btn px-7 py-3"
        >
          {starting ? t('جاري تجهيز الغرفة…') : t('▶ ابدأ اللعبة')}
        </button>
      </div>
    </div>
  );
}
