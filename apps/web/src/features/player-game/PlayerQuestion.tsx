import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { Spinner } from '../../components/Loading';
import { SubmittedAnswer } from './SubmittedAnswer';
import type { PlayerGameController } from './use-player-game';
const optionBadgeColors = [
  'bg-brand-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-orange-500',
];
export function PlayerQuestion({
  game,
}: {
  game: Pick<
    PlayerGameController,
    | 'snapshot'
    | 'selectedOption'
    | 'textAnswer'
    | 'setTextAnswer'
    | 'submission'
    | 'rejection'
    | 'imageLoaded'
    | 'setImageLoaded'
    | 'imageError'
    | 'setImageError'
    | 'countdown'
    | 'question'
    | 'imageBlocking'
    | 'resolvedQuestionImage'
    | 'submit'
  > & {
    snapshot: NonNullable<PlayerGameController['snapshot']>;
    question: NonNullable<PlayerGameController['question']>;
  };
}) {
  const {
    snapshot,
    selectedOption,
    textAnswer,
    setTextAnswer,
    submission,
    rejection,
    imageLoaded,
    setImageLoaded,
    imageError,
    setImageError,
    countdown,
    question,
    imageBlocking,
    resolvedQuestionImage,
    submit,
  } = game;
  return (
    <section className="card space-y-4 p-4 sm:space-y-5 sm:p-7">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">
          السؤال {(snapshot.questionIndex ?? 0) + 1}
        </span>
        <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-lg font-black text-amber-700">
          {countdown.seconds}
        </span>
      </div>

      {question.essentialImage && (
        <div className="relative grid min-h-36 place-items-center overflow-hidden rounded-2xl bg-slate-50 sm:min-h-44">
          {!imageLoaded && !imageError && (
            <p className="absolute inset-x-0 px-4 text-center text-sm font-bold text-slate-500">
              نجهّز صورة السؤال… يمكنك متابعة قراءة النص.
            </p>
          )}
          <img
            src={resolvedQuestionImage}
            alt="صورة السؤال"
            fetchPriority="high"
            decoding="sync"
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={() => setImageError(true)}
            className={`max-h-64 w-full object-contain transition-opacity duration-150 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      )}

      {imageError && question.essentialImage && (
        <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
          تعذّر تحميل الصورة، ووقت السؤال مستمر.
          <button
            className="mr-3 underline"
            onClick={() => {
              setImageError(false);
              if (question.essentialImage)
                globalMediaPrefetchEngine.prioritizeUpcoming(question.essentialImage, true);
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      <h2 className="py-2 text-center text-xl font-black leading-9 text-slate-900 sm:py-3 sm:text-2xl">
        {question.text}
      </h2>

      {(question.options?.length ?? 0) > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(question.options ?? []).map((option, index: number) => {
            const selected = selectedOption === option.id;
            const locked = submission === 'submitting' || submission === 'accepted';
            return (
              <button
                key={option.id}
                disabled={imageBlocking || locked}
                onClick={() => submit(option.id)}
                className={`relative flex min-h-18 cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-right font-black transition-all duration-200 active:scale-[.98] ${
                  selected
                    ? submission === 'accepted'
                      ? 'answer-locked border-indigo-600 bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-200/80 ring-4 ring-indigo-500/20'
                      : 'border-indigo-500 bg-indigo-50 text-indigo-950 shadow-lg shadow-indigo-100'
                    : selectedOption
                      ? 'border-slate-200/70 bg-slate-100/70 text-slate-400 opacity-45 scale-[0.98]'
                      : 'border-slate-200 bg-white text-slate-800 shadow-2xs hover:border-brand-300 hover:bg-brand-50/50'
                } disabled:cursor-default`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black transition-colors ${
                      selected && submission === 'accepted'
                        ? 'bg-white/20 text-white'
                        : `${optionBadgeColors[index % optionBadgeColors.length]} text-white`
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="break-words">{option.text}</span>
                </div>

                {selected && submission === 'submitting' && <Spinner className="h-4 w-4 shrink-0" />}
                {selected && submission === 'accepted' && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-black text-white backdrop-blur-xs">
                    <span>🔒</span>
                    <span>اختيارك</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'ShortAnswer' && (
        <div className="space-y-3">
          <input
            className={`field py-4 text-center text-lg font-bold transition ${
              submission === 'accepted'
                ? 'border-indigo-400 bg-indigo-50/70 text-indigo-950 ring-4 ring-indigo-500/15'
                : ''
            }`}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={imageBlocking || submission === 'submitting' || submission === 'accepted'}
            placeholder="اكتب إجابتك هنا…"
          />
          <button
            className="primary-btn w-full py-3.5"
            onClick={() => submit()}
            disabled={
              !textAnswer.trim() || imageBlocking || submission === 'submitting' || submission === 'accepted'
            }
          >
            تسجيل الإجابة
          </button>
        </div>
      )}

      {submission === 'submitting' && (
        <div className="answer-confirmation mx-auto flex w-fit items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-800">
          <Spinner className="h-4 w-4" />
          نثبّت اختيارك…
        </div>
      )}
      {submission === 'accepted' && <SubmittedAnswer />}
      {submission === 'rejected' && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm font-bold text-rose-700"
        >
          {rejection}
        </div>
      )}
    </section>
  );
}
