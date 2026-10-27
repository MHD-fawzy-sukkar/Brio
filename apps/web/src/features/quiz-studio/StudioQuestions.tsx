'use client';

import { useTranslations } from '../../i18n/use-locale';
import Link from 'next/link';
import type { StudioController } from './use-quiz-studio';
import { questionTypeLabels } from './model';
import type { QuizDetail } from './model';
export function StudioQuestions({
  studio,
}: {
  studio: Pick<
    StudioController,
    | 'quizId'
    | 'quiz'
    | 'uploadTasks'
    | 'identitySaving'
    | 'reordering'
    | 'orderQueue'
    | 'orderStatus'
    | 'orderError'
    | 'starting'
    | 'downloadingLan'
    | 'setDeletingQuestionId'
    | 'questionDrag'
  > & { quiz: QuizDetail };
}) {
  const { t, translateMessage } = useTranslations();
  const {
    quizId,
    quiz,
    uploadTasks,
    identitySaving,
    reordering,
    orderQueue,
    orderStatus,
    orderError,
    starting,
    downloadingLan,
    setDeletingQuestionId,
    questionDrag,
  } = studio;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{t('الأسئلة')}</h2>
          <p className="text-sm text-slate-500">
            {quiz.questions.length
              ? t('{0} سؤال في هذه المسابقة', { 0: quiz.questions.length })
              : t('لا توجد أسئلة بعد')}
          </p>
        </div>
        <Link
          href={`/questions/?quizId=${quizId}`}
          aria-disabled={reordering}
          onClick={(event) => {
            if (reordering) event.preventDefault();
          }}
          className="primary-btn"
        >
          {t('＋ سؤال جديد')}
        </Link>
      </div>
      {quiz.questions.length > 1 && (
        <p id="question-order-help" className="mb-3 text-xs leading-6 text-slate-500">
          {t(
            'اسحب من ⋮⋮ لترتيب الأسئلة، أو استخدم السهم لأعلى أو لأسفل بعد تحديد المقبض. يُحفظ الترتيب فوراً.',
          )}
        </p>
      )}
      <div className="mb-3 min-h-5 text-xs text-brand-700">
        <span role="status" aria-live="polite">
          {translateMessage(orderStatus ?? '')}
        </span>
        {orderError && (
          <span role="alert" className="ms-2 text-rose-700">
            {translateMessage(orderError ?? '')}
            <button
              type="button"
              className="ms-2 font-bold underline"
              onClick={() => {
                void orderQueue?.flush().catch(() => {});
              }}
            >
              {t('إعادة الحفظ')}
            </button>
          </span>
        )}
      </div>
      {quiz.questions.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="text-4xl">✍️</div>
          <h3 className="mt-3 font-black">{t('أضف أول سؤال')}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('ستظهر حقول الإجابات المناسبة بمجرد اختيار نوع السؤال.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {quiz.questions.map((question, index) => {
            const questionTask = uploadTasks
              .filter((t) => t.target === 'question' && t.questionId === question.id)
              .at(-1);
            const questionImage =
              (questionTask?.state !== 'failed'
                ? questionTask?.resultUrl || questionTask?.previewUrl
                : null) ||
              question.media_url ||
              question.essentialImage ||
              null;

            return (
              <article
                key={question.id}
                data-question-id={question.id}
                className={`card question-order-card relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-3.5 ${questionDrag.draggedId === question.id ? 'question-drag-source' : ''} ${questionDrag.target?.target === question.id && questionDrag.draggedId !== question.id ? (questionDrag.target.after ? 'question-drop-after' : 'question-drop-before') : ''}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {quiz.questions.length > 1 && (
                    <button
                      type="button"
                      disabled={starting || downloadingLan || identitySaving}
                      aria-label={t('اسحب لترتيب السؤال {0}: {1}', { 0: index + 1, 1: question.text })}
                      aria-describedby="question-order-help"
                      className="question-drag-handle"
                      {...questionDrag.handleProps(question.id)}
                    >
                      ⋮⋮
                    </button>
                  )}
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 font-black text-brand-700">
                    {index + 1}
                  </span>
                  {questionImage && (
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img
                        src={questionImage}
                        loading="lazy"
                        decoding="async"
                        alt={t('صورة السؤال')}
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-black text-slate-900">{question.text}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                      <span>{questionTypeLabels[question.type] || question.type}</span>
                      <span>·</span>
                      <span>
                        {(question.duration_ms || question.durationMs) / 1000} {t('ثانية')}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <Link
                    href={`/questions/?quizId=${quizId}&questionId=${question.id}`}
                    aria-disabled={reordering}
                    onClick={(event) => {
                      if (reordering) event.preventDefault();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-2 text-sm font-black text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
                  >
                    {t('تعديل')}
                  </Link>
                  <button
                    type="button"
                    disabled={reordering}
                    onClick={() => setDeletingQuestionId(question.id)}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-white px-3.5 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                  >
                    {t('حذف')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
