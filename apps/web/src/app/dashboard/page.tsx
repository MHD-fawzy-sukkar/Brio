'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuizSummaryDto } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { ButtonContent, PageSkeleton } from '../../components/Loading';
import { ConfirmDialog } from '../../components/ConfirmDialog';

function DashboardContent() {
  const [quizzes,setQuizzes] = useState<QuizSummaryDto[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [startingId,setStartingId]=useState<string|null>(null);
  const [deleting,setDeleting]=useState<QuizSummaryDto|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/quizzes',{credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json'}})
      .then(async (response) => {
        const body = await response.json().catch(()=>null);
        if (!response.ok) throw new Error(body?.detail || 'تعذر تحميل مسابقاتك.');
        setQuizzes(body || []);
      })
      .catch((cause) => { if (cause?.name!=='AbortError') setError(cause instanceof Error?cause.message:'تعذر تحميل مسابقاتك.'); })
      .finally(()=>setLoading(false));
    return () => controller.abort();
  },[]);

  const stats = useMemo(() => ({
    quizCount:quizzes.length,
    questionCount:quizzes.reduce((total,quiz)=>total+quiz.questionCount,0),
    lastUpdated:quizzes[0]?.updatedAt
  }),[quizzes]);

  const startRoom = async (quizId:string) => {
    setError(null);setStartingId(quizId);
    try {
      const publishResponse=await fetch(`/api/quizzes/${quizId}/publish`,{method:'POST',credentials:'same-origin'});
      const published=await publishResponse.json().catch(()=>null);
      if(!publishResponse.ok)throw new Error(published?.detail||'أضف سؤالاً صالحاً قبل بدء اللعبة.');
      const response = await fetch('/api/rooms',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({quizId})});
      const body = await response.json().catch(()=>null);
      if (!response.ok) throw new Error(body?.detail || 'انشر المسابقة أولاً ثم حاول مجدداً.');
      window.location.assign(`/host/?roomId=${encodeURIComponent(body.roomId)}&code=${encodeURIComponent(body.code)}`);
    } catch (cause) { setError(cause instanceof Error?cause.message:'تعذر بدء المسابقة.'); setStartingId(null); }
  };

  const deleteQuiz=async()=>{
    if(!deleting)return;
    setDeleteBusy(true);setError(null);
    const response=await fetch(`/api/quizzes/${deleting.id}`,{method:'DELETE',credentials:'same-origin'});
    const body=await response.json().catch(()=>null);
    if(!response.ok){setError(body?.detail||'تعذر حذف المسابقة.');setDeleteBusy(false);setDeleting(null);return;}
    setQuizzes((current)=>current.filter((quiz)=>quiz.id!==deleting.id));setDeleteBusy(false);setDeleting(null);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-black text-violet-600">لوحة المنشئ</p><h1 className="mt-1 text-3xl font-black text-slate-900">مرحباً بك في Brio</h1><p className="mt-2 text-slate-500">تابع مسابقاتك الأخيرة أو ابدأ تجربة جديدة.</p></div><a href="/quizzes/new/" className="primary-btn text-center">＋ إنشاء مسابقة</a></header>
      {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-xs font-bold text-slate-400">المسابقات</p><b className="mt-2 block text-3xl text-slate-900">{stats.quizCount}</b></div>
        <div className="card p-5"><p className="text-xs font-bold text-slate-400">إجمالي الأسئلة</p><b className="mt-2 block text-3xl text-violet-700">{stats.questionCount}</b></div>
        <div className="card p-5"><p className="text-xs font-bold text-slate-400">آخر نشاط</p><b className="mt-3 block text-sm text-slate-700">{stats.lastUpdated?new Date(stats.lastUpdated).toLocaleDateString('ar'):'ابدأ أول مسابقة'}</b></div>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-black text-slate-900">مسابقاتي الأخيرة</h2><p className="mt-1 text-sm text-slate-500">المسودات والمنشورات في مكان واحد.</p></div>{quizzes.length>0&&<span className="text-xs font-bold text-slate-400">{quizzes.length} مسابقة</span>}</div>
        {loading?<PageSkeleton/>:quizzes.length===0?<div className="card py-20 text-center"><div className="text-5xl">✨</div><h3 className="mt-4 text-xl font-black">لا توجد مسابقات بعد</h3><p className="mt-2 text-sm text-slate-500">أنشئ مسابقتك الأولى، ثم أضف الأسئلة في الاستوديو.</p><a href="/quizzes/new/" className="primary-btn mt-6 inline-block">إنشاء أول مسابقة</a></div>:
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{quizzes.map((quiz)=><article key={quiz.id} className="card overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"><div className="aspect-[16/9] bg-gradient-to-br from-violet-100 via-indigo-50 to-amber-50">{quiz.coverImageUrl?<img src={quiz.coverImageUrl} alt={`غلاف ${quiz.title}`} className="h-full w-full object-contain bg-slate-50"/>:<div className="grid h-full place-items-center text-5xl">⚡</div>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="line-clamp-2 font-black text-slate-900">{quiz.title}</h3><span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{quiz.questionCount} سؤال</span></div><p className="mt-2 text-xs text-slate-400">آخر تعديل {new Date(quiz.updatedAt).toLocaleDateString('ar')}</p><div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2"><a href={`/builder/?quizId=${quiz.id}`} className="secondary-btn text-center text-sm">تعديل</a><button onClick={()=>startRoom(quiz.id)} disabled={startingId===quiz.id} className="primary-btn text-sm"><ButtonContent busy={startingId===quiz.id} busyText="تجهيز…">ابدأ</ButtonContent></button><button onClick={()=>setDeleting(quiz)} aria-label={`حذف ${quiz.title}`} className="rounded-xl border border-rose-100 px-3 text-rose-600 hover:bg-rose-50">🗑️</button></div></div></article>)}</div>}
      </section>
      <ConfirmDialog open={Boolean(deleting)} title="حذف المسابقة؟" description={`سيتم حذف «${deleting?.title||''}» من قائمة مسابقاتك. لا يمكن التراجع عن هذا الإجراء.`} busy={deleteBusy} onCancel={()=>setDeleting(null)} onConfirm={deleteQuiz}/>
    </div>
  );
}

export default function DashboardPage(){return <AuthGuard><DashboardContent/></AuthGuard>;}
