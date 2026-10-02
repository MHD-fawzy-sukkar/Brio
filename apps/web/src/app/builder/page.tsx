'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AuthoringQuestion } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { uploadQuizCover } from '../../services/media-upload';

interface QuizDetail { id:string; title:string; cover_image_url?:string|null; revision:number; questions:Array<AuthoringQuestion & { id:string; duration_ms?:number; options:Array<{id?:string;text:string;is_correct?:number;isCorrect?:boolean}> }> }

function Builder() {
  const params = useSearchParams();
  const quizId = params.get('quizId');
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    if (!quizId) throw new Error('معرّف المسابقة مفقود.');
    const response = await fetch(`/api/quizzes/${quizId}`);
    if (response.status === 401) return void (window.location.href = '/login/');
    if (!response.ok) throw new Error('تعذر تحميل المسابقة.');
    const data = await response.json();
    setQuiz(data); setTitle(data.title); setCover(data.cover_image_url || '');
  };
  useEffect(() => {
    const notice = params.get('notice');
    if (notice === 'cover-upload-failed') setWarning('تم إنشاء المسابقة بنجاح، لكن تعذر رفع الغلاف. يمكنك المحاولة مجدداً من هنا.');
    if (notice === 'question-image-failed') setWarning('تم حفظ السؤال بنجاح، لكن تعذر رفع صورته. يمكنك تعديل السؤال والمحاولة مجدداً.');
    load().catch((cause) => setError(cause.message));
  }, [quizId]);

  const saveDetails = async () => {
    if (!quizId) return;
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch(`/api/quizzes/${quizId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:title.trim(), coverImageUrl:cover.trim() || null }) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setError(body?.detail || 'تعذر حفظ التفاصيل.');
    setMessage('تم حفظ تفاصيل المسابقة.');
  };

  const uploadCover = async (file?: File) => {
    if (!file || !quizId) return;
    setUploadingCover(true); setError(null); setMessage(null);
    try {
      const variants = await uploadQuizCover(quizId, file);
      setCover(variants.hostUrl); setMessage('تم رفع صورة الغلاف وحفظها.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر رفع الغلاف.'); }
    finally { setUploadingCover(false); }
  };

  const removeQuestion = async (questionId: string) => {
    if (!quizId || !confirm('هل تريد حذف هذا السؤال؟')) return;
    const response = await fetch(`/api/quizzes/${quizId}/questions/${questionId}`, { method:'DELETE' });
    if (!response.ok) return setError('تعذر حذف السؤال.');
    await load();
  };

  const publish = async () => {
    if (!quizId) return;
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch(`/api/quizzes/${quizId}/publish`, { method:'POST' });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setError(body?.detail || 'تعذر نشر المسابقة.');
    setMessage(`نُشرت النسخة ${body.revision} وأصبحت جاهزة للعب.`);
  };

  const removeCover = async () => {
    if (!quizId || !quiz) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/quizzes/${quizId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:title.trim(), coverImageUrl:null }) });
    const body = await response.json().catch(()=>null);
    setBusy(false);
    if (!response.ok) return setError(body?.detail || 'تعذر إزالة الغلاف.');
    setCover(''); setMessage('تمت إزالة صورة الغلاف.');
  };

  const startGame = async () => {
    if (!quizId) return;
    setStarting(true); setError(null); setMessage(null);
    try {
      const publishResponse = await fetch(`/api/quizzes/${quizId}/publish`, { method:'POST' });
      const published = await publishResponse.json().catch(()=>null);
      if (!publishResponse.ok) throw new Error(published?.detail || 'أضف سؤالاً صالحاً قبل بدء اللعبة.');
      const response = await fetch('/api/rooms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({quizId}) });
      const room = await response.json().catch(()=>null);
      if (!response.ok) throw new Error(room?.detail || 'تعذر بدء اللعبة.');
      window.location.assign(`/host/?roomId=${encodeURIComponent(room.roomId)}&code=${encodeURIComponent(room.code)}`);
    } catch (cause) { setError(cause instanceof Error?cause.message:'تعذر بدء اللعبة.'); setStarting(false); }
  };

  const deleteQuiz = async () => {
    if (!quizId) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/quizzes/${quizId}`, { method:'DELETE' });
    const body = await response.json().catch(()=>null);
    if (!response.ok) { setBusy(false); setDeleteOpen(false); return setError(body?.detail || 'تعذر حذف المسابقة.'); }
    window.location.assign('/dashboard/');
  };

  if (!quiz && !error) return <div className="card p-14 text-center text-slate-400">جاري فتح الاستوديو…</div>;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><a href="/dashboard/" className="text-sm font-bold text-violet-600">→ مسابقاتي</a><h1 className="mt-2 text-3xl font-black text-slate-900">استوديو المسابقة</h1><p className="mt-1 text-sm text-slate-500">التفاصيل هنا، وكل سؤال يُحرّر في صفحة هادئة مستقلة.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={startGame} disabled={starting || !quiz?.questions.length} className="primary-btn">{starting?'جاري تجهيز الغرفة…':'▶ ابدأ اللعبة'}</button><button onClick={publish} disabled={busy || !quiz?.questions.length} className="secondary-btn">نشر فقط</button><button onClick={()=>setDeleteOpen(true)} className="rounded-xl px-4 py-2 text-sm font-black text-rose-600 hover:bg-rose-50">حذف</button></div>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      {warning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{warning}<button onClick={()=>setWarning(null)} className="float-left text-amber-600" aria-label="إغلاق التنبيه">×</button></div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}
      {quiz && (
        <>
          <section className="card grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-violet-100 to-amber-50">
              {cover ? <img src={cover} alt="غلاف المسابقة" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-sm font-bold text-slate-400"><span><b className="block text-4xl">🖼️</b>غلاف اختياري</span></div>}
            </div>
            <div className="space-y-4">
              <div><label className="label">عنوان المسابقة</label><input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><label className="label">صورة الغلاف <span className="font-normal text-slate-400">(اختيارية)</span></label><div className="flex flex-wrap gap-2"><label className="secondary-btn inline-flex cursor-pointer justify-center text-center text-sm">{uploadingCover?'جاري رفع الصورة…':cover?'استبدال صورة الغلاف':'اختيار صورة من الجهاز'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" disabled={uploadingCover} onChange={(e) => uploadCover(e.target.files?.[0])} /></label>{cover&&<button type="button" onClick={removeCover} disabled={busy||uploadingCover} className="rounded-xl px-3 py-2 text-sm font-black text-rose-600 hover:bg-rose-50">إزالة الصورة</button>}</div><p className="mt-2 text-xs text-slate-400">JPG أو PNG أو WebP أو AVIF، بحد أقصى 5MB. يفضّل مقاس 16:9.</p></div>
              <button onClick={saveDetails} disabled={busy || !title.trim()} className="secondary-btn">حفظ التفاصيل</button>
            </div>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-900">الأسئلة</h2><p className="text-sm text-slate-500">{quiz.questions.length ? `${quiz.questions.length} سؤال في هذه المسابقة` : 'لا توجد أسئلة بعد'}</p></div><a href={`/questions/?quizId=${quizId}`} className="primary-btn">＋ سؤال جديد</a></div>
            {quiz.questions.length === 0 ? <div className="card p-14 text-center"><div className="text-4xl">✍️</div><h3 className="mt-3 font-black">أضف أول سؤال</h3><p className="mt-1 text-sm text-slate-500">ستظهر حقول الإجابات المناسبة بمجرد اختيار نوع السؤال.</p></div> : (
              <div className="space-y-3">{quiz.questions.map((question, index) => (
                <article key={question.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 font-black text-violet-700">{index + 1}</span>
                  <div className="min-w-0 flex-1"><h3 className="truncate font-black text-slate-900">{question.text}</h3><p className="mt-1 text-xs font-bold text-slate-400">{question.type} · {(question.duration_ms || question.durationMs) / 1000} ثانية</p></div>
                  <div className="flex gap-2"><a href={`/questions/?quizId=${quizId}&questionId=${question.id}`} className="secondary-btn text-sm">تعديل</a><button onClick={() => removeQuestion(question.id)} className="rounded-xl px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50">حذف</button></div>
                </article>
              ))}</div>
            )}
          </section>
        </>
      )}
      {deleteOpen&&<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setDeleteOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="card w-full max-w-md p-7"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-2xl">🗑️</div><h2 id="delete-title" className="mt-4 text-xl font-black text-slate-900">حذف المسابقة؟</h2><p className="mt-2 text-sm leading-6 text-slate-500">سيتم حذف «{title}» من لوحة التحكم. لا يمكن التراجع عن هذا الإجراء.</p><div className="mt-7 flex gap-3"><button onClick={deleteQuiz} disabled={busy} className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700">{busy?'جاري الحذف…':'نعم، احذفها'}</button><button onClick={()=>setDeleteOpen(false)} disabled={busy} className="secondary-btn flex-1">إلغاء</button></div></section></div>}
    </div>
  );
}

export default function BuilderPage() {
  return <AuthGuard><Suspense fallback={<div className="card p-14 text-center">جاري التحميل…</div>}><Builder /></Suspense></AuthGuard>;
}
