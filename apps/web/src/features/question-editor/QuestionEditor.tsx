'use client';

import { QuestionSettings } from './QuestionSettings';
import { useTranslations } from '../../i18n/use-locale';

import Link from 'next/link';
import type { QuestionType } from '@brio/contracts';
import { ButtonContent, PageSkeleton } from '../../components/Loading';
import { typeLabels } from './model';
import { useQuestionEditor } from './use-question-editor';
export function QuestionEditor() {
  const { t, translateMessage } = useTranslations();
  const {
    quizId,
    questionId,
    edited,
    setLoadRevision,
    loadingQuestion,
    question,
    setQuestion,
    busy,
    error,
    setError,
    imageFile,
    activeUpload,
    visibleImageUrl,
    changeType,
    updateOption,
    markCorrect,
    addOption,
    removeOption,
    chooseImage,
    removeImage,
    save,
  } = useQuestionEditor();
  if (loadingQuestion) return <PageSkeleton kind="question" />;
  if (questionId && !question.id && error)
    return (
      <div className="card mx-auto max-w-5xl space-y-4 p-6">
        <p role="alert" className="text-sm text-rose-700">
          {translateMessage(error ?? '')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              setError(null);
              setLoadRevision((value) => value + 1);
            }}
          >
            {t('إعادة المحاولة')}
          </button>
          <Link className="secondary-btn" href={`/builder/?quizId=${quizId ?? ''}`}>
            {t('العودة إلى المسابقة')}
          </Link>
        </div>
      </div>
    );
  return (
    <form
      onChangeCapture={() => {
        edited.current = true;
      }}
      onSubmit={save}
      className="mx-auto max-w-5xl space-y-6"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black">{questionId ? t('تعديل السؤال') : t('سؤال جديد')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('ركّز على سؤال واحد؛ سيُحفظ فوراً وتُرفع الصورة في الخلفية.')}
          </p>
        </div>
        <Link href={`/builder/?quizId=${quizId || ''}`} className="secondary-btn">
          {t('→ العودة إلى المسابقة')}
        </Link>
      </header>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {translateMessage(error ?? '')}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card space-y-6 p-6">
          <div>
            <label className="label">{t('نوع السؤال')}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(typeLabels) as QuestionType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => changeType(type)}
                  className={`rounded-xl border p-3 text-sm font-black ${question.type === type ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  {translateMessage(typeLabels[type])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              {t('صورة السؤال')} <span className="font-normal text-slate-400">{t('(اختيارية)')}</span>
            </label>
            <div className="relative">
              <label className="group relative grid min-h-52 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-brand-400 hover:bg-brand-50/50">
                {visibleImageUrl ? (
                  <img
                    src={visibleImageUrl}
                    alt={t('معاينة صورة السؤال')}
                    className="max-h-72 w-full object-contain p-3"
                  />
                ) : (
                  <div className="text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
                      🖼️
                    </span>
                    <b className="mt-3 block text-sm text-slate-700">{t('أضف صورة توضيحية')}</b>
                    <small className="mt-1 block text-slate-400">{t('تظهر كاملة دون قص')}</small>
                  </div>
                )}
                <span className="absolute bottom-3 end-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-brand-700 shadow-md">
                  {imageFile ? t('تغيير الصورة') : t('رفع صورة')}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    chooseImage(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {visibleImageUrl && (
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={busy}
                  aria-label={t('حذف الصورة')}
                  title={t('حذف الصورة')}
                  className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-white/95 text-lg text-slate-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </div>
            {activeUpload?.state === 'uploading' && (
              <p role="status" className="mt-2 text-xs font-bold text-brand-600">
                {t('جاري رفع الصورة في الخلفية… تظهر المعاينة الآن وسيُحدّث الرابط تلقائياً.')}
              </p>
            )}
            {activeUpload?.state === 'failed' && (
              <p role="alert" className="mt-2 text-xs font-bold text-rose-600">
                {t('تعذر رفع الصورة. اخترها مجدداً ثم احفظ السؤال لإعادة المحاولة.')}
              </p>
            )}
            {!activeUpload && <p className="mt-2 text-xs text-slate-400">{t('حتى 5MB. ')}</p>}
          </div>
          <div>
            <label className="label">{t('نص السؤال')}</label>
            <textarea
              className="field min-h-28 resize-y text-lg font-bold"
              maxLength={1000}
              value={question.text}
              onChange={(e) => setQuestion({ ...question, text: e.target.value })}
              placeholder={t('اكتب السؤال بوضوح…')}
              required
            />
          </div>
          {(question.type === 'MultipleChoice' ||
            question.type === 'TrueFalse' ||
            question.type === 'Poll') && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="label !mb-0">
                  {t('الإجابات')}{' '}
                  {question.type !== 'Poll' && (
                    <span className="font-normal text-slate-400">{t('— اختر الصحيحة')}</span>
                  )}
                </label>
                {question.type !== 'TrueFalse' && (
                  <button type="button" onClick={addOption} className="text-sm font-black text-brand-600">
                    {t('＋ إضافة خيار')}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <button
                      tabIndex={-1}
                      type="button"
                      aria-label={t('تعيين كإجابة صحيحة')}
                      disabled={question.type === 'Poll'}
                      onClick={() => markCorrect(index)}
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 font-black ${option.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'} disabled:border-slate-200`}
                    >
                      ✓
                    </button>
                    <input
                      className="field"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={t('الإجابة {0}', { 0: index + 1 })}
                      maxLength={200}
                      required
                    />
                    {question.type !== 'TrueFalse' && (
                      <button
                        tabIndex={-1}
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={question.options.length <= 2}
                        aria-label={t('حذف الخيار')}
                        className="rounded-xl px-2 py-2 font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {question.type === 'ShortAnswer' && (
            <div>
              <div className="mb-3 flex justify-between">
                <label className="label !mb-0">{t('الإجابات المقبولة')}</label>
                <button
                  type="button"
                  onClick={() =>
                    setQuestion({ ...question, acceptedAlternatives: [...question.acceptedAlternatives, ''] })
                  }
                  className="text-sm font-black text-brand-600"
                >
                  {t('＋ إضافة صيغة')}
                </button>
              </div>
              <div className="space-y-3">
                {question.acceptedAlternatives.map((answer, index) => (
                  <input
                    key={index}
                    className="field"
                    value={answer}
                    onChange={(e) =>
                      setQuestion({
                        ...question,
                        acceptedAlternatives: question.acceptedAlternatives.map((item, i) =>
                          i === index ? e.target.value : item,
                        ),
                      })
                    }
                    placeholder={t('مثال: الرياض')}
                    required={index === 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action button right below the options so the user doesn't have to scroll up */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <Link
              href={`/builder/?quizId=${quizId || ''}`}
              className="text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              {t('إلغاء والعودة')}
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="primary-btn py-3 px-8 text-base shadow-md shadow-brand-100"
            >
              <ButtonContent busy={busy} busyText={t('جاري الحفظ…')}>
                {t('حفظ السؤال')}
              </ButtonContent>
            </button>
          </div>
        </section>
        <QuestionSettings question={question} setQuestion={setQuestion} />
      </div>
    </form>
  );
}
