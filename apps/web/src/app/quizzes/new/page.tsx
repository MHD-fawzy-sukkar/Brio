'use client';

import Link from 'next/link';
import { BoltMascot } from '../../../components/BoltMascot';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../../../components/AuthGuard';
import { validateImage } from '../../../services/media-upload';
import { backgroundUploads } from '../../../services/background-upload';
import { ButtonContent } from '../../../components/Loading';

import type { SaveIdentityRequest, ThemeSummaryDto } from '@brio/contracts';
import { IdentityEditor } from '../../../features/competition-identity/IdentityEditor';
import { ThemeLibraryPicker } from '../../../features/competition-identity/ThemeLibraryPicker';
import { ThemeModePicker } from '../../../features/competition-identity/ThemeModePicker';
import { requestJson, jsonBody } from '../../../services/http-json';

function NewQuizForm() {
  const router = useRouter();
  const [themeMode, setThemeMode] = useState<'default' | 'new' | 'saved'>('default');
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummaryDto | null>(null);
  const [identityDraft, setIdentityDraft] = useState<SaveIdentityRequest | null>(null);
  const draftChanged = useCallback((input: SaveIdentityRequest | null) => setIdentityDraft(input), []);
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseCover = (file?: File) => {
    if (!file) return;
    try {
      validateImage(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCoverFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'الصورة غير صالحة.');
    }
  };

  const createQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy || (themeMode === 'new' && !identityDraft) || (themeMode === 'saved' && !selectedTheme)) return;
    setBusy(true); setError(null); setProgress('جاري إنشاء المسابقة…');
    try {
      const quiz = await requestJson<{ id: string }>('/api/quizzes', jsonBody('POST', {
        title: title.trim(), coverImageUrl: null, questions: [],
        ...(themeMode === 'new' && identityDraft ? { identity: identityDraft } : {}),
        ...(themeMode === 'saved' && selectedTheme ? { identityId: selectedTheme.id } : {})
      }));

      if (coverFile) {
        backgroundUploads.enqueueCover(quiz.id, coverFile);
      }
      setProgress('تم الإنشاء، جاري فتح الاستوديو…');
      router.push(`/builder/?quizId=${encodeURIComponent(quiz.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المسابقة.');
      setBusy(false); setProgress('');
    }
  };

  return (
    <div className="quiz-create mx-auto w-full">
      <Link href="/dashboard/" className="text-sm font-black text-brand-600">→ العودة إلى لوحة التحكم</Link>
      <header className="mb-6 mt-4"><p className="text-xs font-black text-brand-600">مسابقة جديدة</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">جهّز مسابقتك بطابعك</h1><p className="mt-2 text-sm leading-7 text-slate-500">المعلومات الأساسية بجانب الهوية، وكل شيء قابل للمراجعة قبل المتابعة.</p></header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      <form onSubmit={createQuiz}>
        <fieldset disabled={busy} className="quiz-create__layout">
          <section className="quiz-create__basics card min-w-0 space-y-5 p-5 sm:p-6">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm font-black text-brand-700">1</span><h2 className="font-black">معلومات المسابقة</h2></div>
            <div><label className="label" htmlFor="quiz-title">اسم المسابقة</label><input id="quiz-title" className="field py-3.5 font-bold" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="مثال: تحدي المعرفة الأسبوعي" autoFocus required /></div>
            <div><span className="label">صورة الغلاف <span className="font-normal text-slate-400">اختيارية</span></span>
              <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-brand-200 bg-brand-50/30">
                <div className="grid aspect-[2/1] place-items-center overflow-hidden">{previewUrl ? <img src={previewUrl} alt="معاينة غلاف المسابقة" className="h-full w-full object-cover" /> : <BoltMascot className="w-40" />}</div>
                <span className="block border-t border-brand-100 bg-white/80 p-3 text-center text-sm font-bold text-brand-700">{coverFile ? 'تغيير صورة الغلاف' : '＋ اختيار غلاف من جهازك'}</span>
                <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => chooseCover(event.target.files?.[0])} />
              </label>
              {coverFile && <button type="button" onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setCoverFile(null); setPreviewUrl(null); }} className="mt-2 text-xs font-bold text-rose-700">إزالة الغلاف</button>}
            </div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">مسابقتك</p><p className="mt-1 break-words font-black text-slate-900">{title.trim() || 'اسم مسابقتك'}</p><p className="mt-2 text-xs leading-6 text-slate-500">بعد الإنشاء تنتقل إلى استوديو الأسئلة. يمكنك تعديل الاسم والغلاف لاحقاً.</p></div>
            <div className="quiz-create__footer space-y-3 border-t border-slate-100 pt-5">
              <p id="quiz-create-hint" className="text-sm leading-7 text-slate-500" aria-live="polite">{themeMode === 'new' && !identityDraft ? 'أكمل اسم الثيم وأضف صوره للمتابعة.' : themeMode === 'saved' && !selectedTheme ? 'اختر ثيماً من المكتبة للمتابعة.' : 'الخطوة التالية: إعداد أسئلة المسابقة.'}</p>
              <button type="submit" aria-describedby="quiz-create-hint" disabled={busy || !title.trim() || (themeMode === 'new' && !identityDraft) || (themeMode === 'saved' && !selectedTheme)} className="primary-btn w-full whitespace-normal py-3.5 leading-7"><ButtonContent busy={busy} busyText={progress || 'جاري الإنشاء…'}>إنشاء المسابقة والمتابعة</ButtonContent></button>
            </div>
          </section>
          <section className="quiz-create__theme card min-w-0 space-y-5 p-5 sm:p-6" aria-label="ثيم المسابقة">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm font-black text-brand-700">2</span><div><h2 className="font-black">هوية المسابقة</h2><p className="mt-1 text-xs text-slate-500">احتفظ ببولت أو اختر طابعاً مناسباً لجهتك.</p></div></div>
            <ThemeModePicker value={themeMode} onChange={mode => { if (mode === 'new') setIdentityDraft(null); setThemeMode(mode); }} />
            {themeMode === 'default' && <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"><BoltMascot className="w-24 shrink-0" /><div><p className="font-black">جاهزة بهوية Brio</p><p className="mt-1 text-sm leading-7 text-slate-500">شخصية بولت وأفاتاراته الأصلية. يمكنك إنشاء المسابقة الآن.</p></div></div>}
            {themeMode === 'new' && <IdentityEditor defaultName="" onDraftChange={draftChanged} />}
            {themeMode === 'saved' && <ThemeLibraryPicker selected={selectedTheme} onSelect={setSelectedTheme} />}
          </section>
        </fieldset>
      </form>
    </div>
  );
}

export default function NewQuizPage() { return <AuthGuard><NewQuizForm /></AuthGuard>; }
