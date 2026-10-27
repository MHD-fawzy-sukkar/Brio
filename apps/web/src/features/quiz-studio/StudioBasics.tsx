'use client';

import { useTranslations } from '../../i18n/use-locale';
import { Spinner } from '../../components/Loading';
import type { StudioController } from './use-quiz-studio';
import type { QuizDetail } from './model';
export function StudioBasics({
  studio,
}: {
  studio: Pick<
    StudioController,
    | 'quiz'
    | 'title'
    | 'setTitle'
    | 'isEditingTitle'
    | 'setIsEditingTitle'
    | 'titleSaved'
    | 'titleInputRef'
    | 'cover'
    | 'coverUploading'
    | 'displayCover'
    | 'hasCover'
    | 'uploadCover'
    | 'removeCover'
    | 'startEditingTitle'
    | 'commitTitle'
  > & { quiz: QuizDetail };
}) {
  const { t } = useTranslations();
  const {
    quiz,
    title,
    setTitle,
    isEditingTitle,
    setIsEditingTitle,
    titleSaved,
    titleInputRef,
    cover,
    coverUploading,
    displayCover,
    hasCover,
    uploadCover,
    removeCover,
    startEditingTitle,
    commitTitle,
  } = studio;
  return (
    <section
      data-mascot-flight-boundary
      className="card grid gap-6 p-6 sm:p-7 lg:grid-cols-[290px_1fr] lg:items-stretch"
    >
      <div className="quiz-cover-frame group aspect-[16/10] rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-brand-50 via-white to-amber-50 transition hover:border-brand-400">
        {hasCover && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void removeCover();
            }}
            aria-label={t('حذف صورة الغلاف')}
            title={t('حذف صورة الغلاف')}
            className=" absolute top-2.5 start-2.5 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-slate-200/90 bg-white/95 text-slate-600 shadow-md backdrop-blur-xs transition-all duration-200 hover:scale-110 hover:border-rose-600 hover:bg-rose-600 hover:text-white active:scale-95"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        )}
        <label className="grid h-full w-full cursor-pointer place-items-center">
          {displayCover ? (
            <img
              src={displayCover}
              alt={t('غلاف المسابقة')}
              className="h-full w-full bg-slate-50/90 object-contain p-2"
            />
          ) : (
            <div className="p-4 text-center text-sm font-bold text-slate-400">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-xs">
                🖼️
              </span>
              <b className="mt-2.5 block text-slate-600">{t('غلاف المسابقة')}</b>
              <small className="mt-1 block text-xs text-slate-400">{t('اضغط لإضافة صورة')}</small>
            </div>
          )}
          <span className="absolute bottom-2.5 end-2.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-black text-brand-700 shadow-sm transition group-hover:bg-brand-600 group-hover:text-white">
            {hasCover ? t('تغيير الغلاف') : t('رفع غلاف')}
          </span>
          {coverUploading && (
            <span className="absolute bottom-2.5 start-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-600/95 px-3 py-1 text-[11px] font-black text-white shadow-sm">
              <Spinner className="h-3 w-3" />
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              uploadCover(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-50/80 via-white to-brand-50/30 p-4 sm:p-5 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700 ring-1 ring-brand-200/60">
            <span>🎯</span>
            <span>{t('عنوان المسابقة')}</span>
          </span>
          {titleSaved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200/70">
              {t('✓ تم حفظ العنوان')}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-400">
              {t('اضغط على العنوان أو أيقونة القلم للتعديل')}
            </span>
          )}
        </div>

        <div
          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-2xl border-2 bg-white shadow-2xs transition ${
            isEditingTitle
              ? 'border-brand-500 ring-4 ring-brand-500/12'
              : 'border-slate-200/90 hover:border-brand-300'
          }`}
        >
          <input
            id="quiz-title-input"
            dir="auto"
            ref={titleInputRef}
            readOnly={!isEditingTitle}
            value={title}
            maxLength={120}
            onClick={() => {
              if (!isEditingTitle) startEditingTitle();
            }}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (isEditingTitle) void commitTitle();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitTitle();
              } else if (e.key === 'Escape') {
                setTitle(quiz.title);
                setIsEditingTitle(false);
              }
            }}
            className={`min-w-0 w-full bg-transparent px-4 py-4 text-2xl font-black text-slate-900 outline-none sm:text-3xl ${
              isEditingTitle ? 'cursor-text' : 'cursor-pointer'
            }`}
            placeholder={t('اكتب عنوان المسابقة…')}
          />
          {isEditingTitle ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void commitTitle()}
              aria-label={t('حفظ عنوان المسابقة')}
              title={t('حفظ العنوان')}
              className="me-3 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-brand-700"
            >
              {t('✓ حفظ')}
            </button>
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              aria-label={t('تعديل عنوان المسابقة')}
              title={t('تعديل العنوان')}
              className="me-3 grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-slate-200/90 bg-slate-50 text-base text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              ✏️
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
            <span>📋</span>
            <span>
              {quiz.questions.length
                ? t('{0} أسئلة في المسابقة', { 0: quiz.questions.length })
                : t('لا توجد أسئلة بعد')}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
            <span>⏱️</span>
            <span>
              {Math.round(
                quiz.questions.reduce((sum, q) => sum + (q.duration_ms || q.durationMs || 20000), 0) / 1000,
              )}{' '}
              {t('ثانية إجمالاً')}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
