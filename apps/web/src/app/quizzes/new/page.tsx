'use client';

import { useTranslations } from '../../../i18n/use-locale';

import Link from 'next/link';
import { BoltMascot } from '../../../components/BoltMascot';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../../../components/AuthGuard';
import { validateImage } from '../../../services/media-upload';
import { backgroundUploads } from '../../../services/background-upload';
import { ButtonContent } from '../../../components/Loading';

import type { ThemeSummaryDto } from '@brio/contracts';
import { IdentityEditor, type IdentityDraft } from '../../../features/competition-identity/IdentityEditor';
import { ThemeLibraryPicker } from '../../../features/competition-identity/ThemeLibraryPicker';
import { ThemeModePicker } from '../../../features/competition-identity/ThemeModePicker';
import { prefetchThemeLibrary } from '../../../features/competition-identity/api';
import { backgroundIdentitySaves } from '../../../features/competition-identity/background-identity-saves';
import { setResource } from '../../../services/resource-cache';
import type { QuizDetail } from '../../../features/quiz-studio/model';
import { requestJson, jsonBody } from '../../../services/http-json';

function NewQuizForm() {
  const { t, translateMessage } = useTranslations();
  const router = useRouter();
  useEffect(() => {
    void prefetchThemeLibrary();
    router.prefetch('/builder/');
  }, []);
  const [themeMode, setThemeMode] = useState<'default' | 'new' | 'saved'>('default');
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummaryDto | null>(null);
  const [identityDraft, setIdentityDraft] = useState<IdentityDraft | null>(null);
  const draftChanged = useCallback((input: IdentityDraft | null) => setIdentityDraft(input), []);
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const chooseCover = (file?: File) => {
    if (!file) return;
    try {
      validateImage(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCoverFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('الصورة غير صالحة.'));
    }
  };

  const createQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !title.trim() ||
      busy ||
      (themeMode === 'new' && !identityDraft) ||
      (themeMode === 'saved' && !selectedTheme)
    )
      return;
    setBusy(true);
    setError(null);
    setProgress(t('جاري إنشاء المسابقة…'));
    try {
      const quiz = await requestJson<QuizDetail>(
        '/api/quizzes',
        jsonBody('POST', {
          title: title.trim(),
          coverImageUrl: null,
          questions: [],
          ...(themeMode === 'saved' && selectedTheme ? { identityId: selectedTheme.id } : {}),
        }),
      );

      setResource(`/api/quizzes/${quiz.id}`, quiz);
      if (themeMode === 'new' && identityDraft) {
        backgroundIdentitySaves.enqueue(quiz.id, identityDraft.name, identityDraft.handoff());
      }
      if (coverFile) {
        backgroundUploads.enqueueCover(quiz.id, coverFile);
      }
      setProgress(t('جاري إنشاء المسابقة…'));
      router.push(`/builder/?quizId=${encodeURIComponent(quiz.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذر إنشاء المسابقة.'));
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="quiz-create mx-auto w-full">
      <Link
        href="/dashboard/"
        className="secondary-btn inline-flex items-center justify-center gap-2 text-sm font-black"
      >
        <span aria-hidden="true" className="inline-block ltr:rotate-180">
          →
        </span>{' '}
        {t('العودة إلى لوحة التحكم')}
      </Link>
      <header className="mb-6 mt-4">
        <p className="text-xs font-black text-brand-600">{t('مسابقة جديدة')}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{t('جهّز مسابقتك بطابعك')}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          {t('اختر اسم المسابقة وغلافها وهويتها، ثم تابع إلى إعداد الأسئلة.')}
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          {translateMessage(error ?? '')}
        </div>
      )}
      <form onSubmit={createQuiz}>
        <fieldset disabled={busy} className="quiz-create__layout">
          <div className="quiz-create__columns">
            <section className="quiz-create__basics card min-w-0 space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm font-black text-brand-700">
                  1
                </span>
                <h2 className="font-black">{t('معلومات المسابقة')}</h2>
              </div>
              <div>
                <label className="label" htmlFor="quiz-title">
                  {t('اسم المسابقة')}
                </label>
                <input
                  id="quiz-title"
                  className="field py-3.5 font-bold"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder={t('مثال: تحدي المعرفة الأسبوعي')}
                  autoFocus
                  required
                />
              </div>
              <div>
                <span className="label">
                  {t('صورة الغلاف')} <span className="font-normal text-slate-400">{t('اختيارية')}</span>
                </span>
                <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-brand-200 bg-brand-50/30">
                  <div className="quiz-cover-frame grid aspect-[2/1] place-items-center bg-white">
                    {previewUrl ? (
                      <img src={previewUrl} alt={t('معاينة غلاف المسابقة')} />
                    ) : (
                      <BoltMascot className="w-40" />
                    )}
                  </div>
                  <span className="block border-t border-brand-100 bg-white/80 p-3 text-center text-sm font-bold text-brand-700">
                    {coverFile ? t('تغيير صورة الغلاف') : t('＋ اختيار غلاف من جهازك')}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(event) => chooseCover(event.target.files?.[0])}
                  />
                </label>
                {coverFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setCoverFile(null);
                      setPreviewUrl(null);
                    }}
                    className="mt-2 text-xs font-bold text-rose-700"
                  >
                    {t('إزالة الغلاف')}
                  </button>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">{t('مسابقتك')}</p>
                <p className="mt-1 break-words font-black text-slate-900">
                  {title.trim() || t('اسم مسابقتك')}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {t('بعد الإنشاء تنتقل إلى استوديو الأسئلة. يمكنك تعديل الاسم والغلاف لاحقاً.')}
                </p>
              </div>
            </section>
            <section
              className="quiz-create__theme card min-w-0 space-y-5 p-5 sm:p-6"
              aria-label={t('هوية المسابقة')}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm font-black text-brand-700">
                  2
                </span>
                <div>
                  <h2 className="font-black">{t('هوية المسابقة')}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('احتفظ ببولت أو اختر طابعاً مناسباً لجهتك.')}
                  </p>
                </div>
              </div>
              <ThemeModePicker
                value={themeMode}
                onChange={(mode) => {
                  if (mode === 'new') setIdentityDraft(null);
                  setThemeMode(mode);
                }}
              />
              {themeMode === 'default' && (
                <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                  <BoltMascot className="w-24 shrink-0" />
                  <div>
                    <p className="font-black">{t('جاهزة بهوية Brio')}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-500">
                      {t('شخصية بولت وأفاتاراته الأصلية. يمكنك إنشاء المسابقة الآن.')}
                    </p>
                  </div>
                </div>
              )}
              {themeMode === 'new' && <IdentityEditor defaultName="" onDraftChange={draftChanged} />}
              {themeMode === 'saved' && (
                <ThemeLibraryPicker selected={selectedTheme} onSelect={setSelectedTheme} />
              )}
            </section>
          </div>
          <div className="quiz-create__footer card min-w-0 space-y-3 p-5 sm:p-6">
            <p id="quiz-create-hint" className="text-sm leading-7 text-slate-500" aria-live="polite">
              {themeMode === 'new' && !identityDraft
                ? t('أكمل اسم الهوية وأضف صورها للمتابعة.')
                : themeMode === 'saved' && !selectedTheme
                  ? t('اختر هوية من المكتبة للمتابعة.')
                  : t('الخطوة التالية: إعداد أسئلة المسابقة.')}
            </p>
            <button
              type="submit"
              aria-describedby="quiz-create-hint"
              disabled={
                busy ||
                !title.trim() ||
                (themeMode === 'new' && !identityDraft) ||
                (themeMode === 'saved' && !selectedTheme)
              }
              className="primary-btn w-full whitespace-normal py-3.5 leading-7"
            >
              <ButtonContent busy={busy} busyText={progress || t('جاري الإنشاء…')}>
                {t('إنشاء المسابقة والمتابعة')}
              </ButtonContent>
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

export default function NewQuizPage() {
  return (
    <AuthGuard>
      <NewQuizForm />
    </AuthGuard>
  );
}
