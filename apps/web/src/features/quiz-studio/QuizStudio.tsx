'use client';

import { useTranslations } from '../../i18n/use-locale';

import { QuizIdentitySettings } from '../competition-identity/QuizIdentitySettings';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { backgroundUploads } from '../../services/background-upload';
import { PageSkeleton } from '../../components/Loading';
import { invalidateResources } from '../../services/resource-cache';
import { useQuizStudio } from './use-quiz-studio';
import { StudioHeader } from './StudioHeader';
import { StudioBasics } from './StudioBasics';
import { StudioQuestions } from './StudioQuestions';

export function QuizStudio() {
  const { t, translateMessage } = useTranslations();
  const studio = useQuizStudio();
  const {
    quizId,
    quiz,
    setQuiz,
    title,
    message,
    warning,
    setWarning,
    error,
    setError,
    setIdentitySaving,
    reordering,
    starting,
    downloadingLan,
    deletingQuestionId,
    setDeletingQuestionId,
    deleteQuestionBusy,
    load,
    failedUploads,
    confirmRemoveQuestion,
    deletingQuestion,
  } = studio;
  if (!quiz && !error) return <PageSkeleton kind="studio" />;
  return (
    <div data-mascot-flight-root className="relative space-y-7">
      <RoamingBolt scope="studio" />
      <StudioHeader studio={{ ...studio, quiz }} />
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          {translateMessage(error ?? '')}
          {!quiz && (
            <button
              type="button"
              className="ms-3 underline"
              onClick={() => {
                setError(null);
                void load().catch((cause) => setError(cause.message));
              }}
            >
              {t('إعادة المحاولة')}
            </button>
          )}
        </div>
      )}
      {warning && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"
        >
          {translateMessage(warning ?? '')}
          <button
            onClick={() => setWarning(null)}
            className="float-end text-amber-600"
            aria-label={t('إغلاق التنبيه')}
          >
            ×
          </button>
        </div>
      )}
      {quiz && quizId && (
        <QuizIdentitySettings
          key={quizId}
          quizId={quizId}
          quizTitle={quiz.title}
          disabled={starting || downloadingLan || reordering}
          value={quiz.identity_id ?? null}
          onBusyChange={setIdentitySaving}
          onSaved={(id) => {
            invalidateResources([`/api/quizzes/${quizId}`]);
            setQuiz((current) => (current?.id === quizId ? { ...current, identity_id: id } : current));
          }}
        />
      )}
      {failedUploads.map((task) => (
        <div
          key={task.id}
          role="alert"
          className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          <span>{translateMessage(task.error ?? '') || t('تعذر رفع الصورة في الخلفية.')}</span>
          <button onClick={() => backgroundUploads.dismiss(task.id)} aria-label={t('إغلاق')}>
            ×
          </button>
        </div>
      ))}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {translateMessage(message ?? '')}
        </div>
      )}
      {quiz && (
        <>
          <StudioBasics studio={{ ...studio, quiz }} />

          <StudioQuestions studio={{ ...studio, quiz }} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(deletingQuestionId)}
        title={t('حذف السؤال؟')}
        description={t('سيتم حذف السؤال «{0}» نهائياً من هذه المسابقة.', { 0: deletingQuestion?.text || '' })}
        busy={deleteQuestionBusy}
        onCancel={() => setDeletingQuestionId(null)}
        onConfirm={confirmRemoveQuestion}
      />
    </div>
  );
}
