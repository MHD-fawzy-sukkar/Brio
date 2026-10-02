'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { uploadQuizCover, validateImage } from '../../../services/media-upload';

function NewQuizForm() {
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
    if (!title.trim() || busy) return;
    setBusy(true); setError(null); setProgress('جاري إنشاء المسابقة…');
    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), coverImageUrl: null, questions: [] })
      });
      const quiz = await response.json().catch(() => null);
      if (!response.ok) throw new Error(quiz?.detail || 'تعذر إنشاء المسابقة.');

      if (coverFile) {
        setProgress('جاري رفع الغلاف وتجهيز نسخه السريعة…');
        try {
          await uploadQuizCover(quiz.id, coverFile);
        } catch {
          window.location.assign(`/builder/?quizId=${encodeURIComponent(quiz.id)}&notice=cover-upload-failed`);
          return;
        }
      }
      window.location.assign(`/builder/?quizId=${encodeURIComponent(quiz.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المسابقة.');
      setBusy(false); setProgress('');
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <a href="/dashboard/" className="text-sm font-black text-violet-600">→ العودة إلى لوحة التحكم</a>
      <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_360px]">
        <form onSubmit={createQuiz} className="card space-y-6 p-7 sm:p-9">
          <div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">مسابقة جديدة</span><h1 className="mt-4 text-3xl font-black text-slate-900">ابدأ بفكرة واضحة</h1><p className="mt-2 text-sm leading-6 text-slate-500">أضف الاسم والغلاف الآن، ثم انتقل إلى استوديو الأسئلة في صفحة مستقلة.</p></div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
          <div><label className="label">اسم المسابقة</label><input className="field py-3.5 text-lg font-bold" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="مثال: تحدي المعرفة الأسبوعي" autoFocus required /></div>
          <div><label className="label">صورة الغلاف <span className="font-normal text-slate-400">(اختيارية)</span></label><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-sm font-black text-slate-600 transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🖼️</span><span>{coverFile ? 'اختيار صورة أخرى' : 'اختر صورة من جهازك'}</span><input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseCover(event.target.files?.[0])} /></label>{coverFile&&<button type="button" onClick={()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);setCoverFile(null);setPreviewUrl(null);}} className="mt-2 text-sm font-black text-rose-600 hover:underline">إزالة الصورة</button>}<p className="mt-2 text-xs text-slate-400">حتى 5MB. تُرفع بأمان وتُجهّز تلقائياً عبر Cloudinary.</p></div>
          <button disabled={busy || !title.trim()} className="primary-btn w-full py-3.5">{busy ? progress : 'إنشاء المسابقة والمتابعة'}</button>
        </form>
        <aside className="card h-fit overflow-hidden">
          <div className="aspect-[16/10] bg-gradient-to-br from-violet-100 via-indigo-50 to-amber-50">{previewUrl ? <img src={previewUrl} alt="معاينة غلاف المسابقة" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-slate-400"><span><b className="block text-5xl">⚡</b><small className="mt-2 block font-bold">معاينة الغلاف</small></span></div>}</div>
          <div className="p-5"><p className="text-xs font-bold text-slate-400">المعاينة</p><h2 className="mt-1 break-words text-xl font-black text-slate-900">{title.trim() || 'اسم مسابقتك'}</h2><p className="mt-3 text-xs leading-5 text-slate-500">يمكنك تغيير الاسم أو الغلاف لاحقاً من استوديو المسابقة.</p></div>
        </aside>
      </div>
    </div>
  );
}

export default function NewQuizPage() { return <AuthGuard><NewQuizForm /></AuthGuard>; }
