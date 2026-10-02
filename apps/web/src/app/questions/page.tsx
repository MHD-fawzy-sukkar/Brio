'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthoringQuestion, PointsMultiplier, QuestionType } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { validateImage } from '../../services/media-upload';
import { backgroundUploads, type UploadTask } from '../../services/background-upload';
import { ButtonContent, PageSkeleton } from '../../components/Loading';
import { multiplierAfterTypeChange } from '../../services/question-form';

const typeLabels: Record<QuestionType,string> = { MultipleChoice:'اختيار من متعدد', TrueFalse:'صح أو خطأ', ShortAnswer:'إجابة قصيرة', Poll:'استطلاع رأي' };
const blankOptions = (count:number) => Array.from({length:count},(_,index) => ({ text:'', isCorrect:index === 0 }));

function QuestionEditor() {
  const router=useRouter();
  const params = useSearchParams();
  const quizId = params.get('quizId');
  const questionId = params.get('questionId');
  const [question, setQuestion] = useState<AuthoringQuestion>({ type:'MultipleChoice', text:'', durationMs:20000, multiplier:'Standard', options:blankOptions(4), acceptedAlternatives:[], essentialImage:null });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [imageFile,setImageFile] = useState<File|null>(null);
  const [imagePreview,setImagePreview] = useState<string|null>(null);
  const [storedImageUrl,setStoredImageUrl] = useState<string|null>(null);
  const [activeUpload,setActiveUpload] = useState<UploadTask|undefined>();
  const uploadedImageUrl=activeUpload?.state==='failed' ? null : activeUpload?.resultUrl || activeUpload?.previewUrl;
  const visibleImageUrl=imagePreview || uploadedImageUrl || storedImageUrl;

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  useEffect(() => {
    if (!quizId || !questionId) return;
    fetch(`/api/quizzes/${quizId}`).then(async (response) => {
      if (response.status === 401) return void (window.location.href='/login/');
      if (!response.ok) throw new Error('تعذر تحميل السؤال.');
      const data = await response.json();
      const found = data.questions.find((item:{id:string}) => item.id === questionId);
      if (!found) throw new Error('السؤال غير موجود.');
      setQuestion({ id:found.id, type:found.type, text:found.text, durationMs:found.duration_ms, multiplier:found.multiplier, essentialImage:null,
        options:(found.options || []).map((option:{text:string;is_correct:number}) => ({text:option.text,isCorrect:option.is_correct===1})),
        acceptedAlternatives:found.acceptedAlternatives || [] });
      setStoredImageUrl(found.media_url || null);
    }).catch((cause) => setError(cause.message));
  },[quizId,questionId]);

  useEffect(()=>{
    if(!quizId||!questionId)return;
    const update=()=>setActiveUpload(backgroundUploads.latestQuestion(quizId,questionId));
    update(); return backgroundUploads.subscribe(update);
  },[quizId,questionId]);

  const changeType = (type:QuestionType) => {
    setQuestion((current) => ({...current,type,multiplier:multiplierAfterTypeChange(current.type,type,current.multiplier),
      options:type==='MultipleChoice'?blankOptions(4):type==='TrueFalse'?[{text:'صح',isCorrect:true},{text:'خطأ',isCorrect:false}]:type==='Poll'?blankOptions(2).map((item)=>({...item,isCorrect:false})):[],
      acceptedAlternatives:type==='ShortAnswer'?['']:[] }));
  };
  const updateOption = (index:number,text:string) => setQuestion((current) => ({...current,options:current.options.map((option,i)=>i===index?{...option,text}:option)}));
  const markCorrect = (index:number) => setQuestion((current) => ({...current,options:current.options.map((option,i)=>({...option,isCorrect:i===index}))}));
  const addOption = () => setQuestion((current) => ({...current,options:[...current.options,{text:'',isCorrect:false}]}));
  const removeOption = (index:number) => setQuestion((current) => {
    if (current.options.length <= 2) return current;
    const options = current.options.filter((_,i)=>i!==index);
    if (current.type==='MultipleChoice' && !options.some((option)=>option.isCorrect)) options[0] = {...options[0],isCorrect:true};
    return {...current,options};
  });
  const chooseImage = (file?:File) => {
    if (!file) return;
    try {
      validateImage(file);
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImageFile(file); setImagePreview(URL.createObjectURL(file)); setError(null);
    } catch (cause) { setError(cause instanceof Error?cause.message:'الصورة غير صالحة.'); }
  };

  const save = async (event:React.FormEvent) => {
    event.preventDefault();
    if (!quizId) return setError('معرّف المسابقة مفقود.');
    setBusy(true); setError(null);
    const payload = {...question, essentialImage:null, text:question.text.trim(), options:question.options.map((option)=>({...option,text:option.text.trim()})), acceptedAlternatives:question.acceptedAlternatives.map((item)=>item.trim()).filter(Boolean)};
    const path = questionId ? `/api/quizzes/${quizId}/questions/${questionId}` : `/api/quizzes/${quizId}/questions`;
    const response = await fetch(path,{method:questionId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const body = await response.json().catch(()=>null);
    if (!response.ok) { setBusy(false); return setError(body?.detail || 'راجع حقول السؤال والإجابات.'); }
    const savedQuestionId = questionId || body?.questionId;
    if (imageFile && savedQuestionId) {
      backgroundUploads.enqueueQuestion(quizId,savedQuestionId,imageFile);
    }
    router.push(`/builder/?quizId=${quizId}`);
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><a href={`/builder/?quizId=${quizId || ''}`} className="text-sm font-bold text-brand-600">→ العودة إلى المسابقة</a><h1 className="mt-2 text-3xl font-black">{questionId?'تعديل السؤال':'سؤال جديد'}</h1><p className="mt-1 text-sm text-slate-500">ركّز على سؤال واحد؛ سيُحفظ فوراً وتُرفع الصورة في الخلفية.</p></div><button disabled={busy} className="primary-btn"><ButtonContent busy={busy} busyText="جاري الحفظ…">حفظ السؤال</ButtonContent></button></header>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card space-y-6 p-6">
          <div><label className="label">نوع السؤال</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(typeLabels) as QuestionType[]).map((type)=><button type="button" key={type} onClick={()=>changeType(type)} className={`rounded-xl border p-3 text-sm font-black ${question.type===type?'border-brand-600 bg-brand-50 text-brand-700':'border-slate-200 bg-white text-slate-500'}`}>{typeLabels[type]}</button>)}</div></div>
          <div><label className="label">صورة السؤال <span className="font-normal text-slate-400">(اختيارية)</span></label><label className="group relative grid min-h-52 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-brand-400 hover:bg-brand-50/50">{visibleImageUrl?<img src={visibleImageUrl} alt="معاينة صورة السؤال" className="max-h-72 w-full object-contain p-3"/>:<div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🖼️</span><b className="mt-3 block text-sm text-slate-700">أضف صورة توضيحية</b><small className="mt-1 block text-slate-400">تظهر كاملة دون قص</small></div>}<span className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-brand-700 shadow-md">{imageFile?'تغيير الصورة':'رفع صورة'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e)=>chooseImage(e.target.files?.[0])}/></label>{activeUpload?.state==='uploading'&&<p role="status" className="mt-2 text-xs font-bold text-brand-600">جاري رفع الصورة في الخلفية… تظهر المعاينة الآن وسيُحدّث الرابط تلقائياً.</p>}{activeUpload?.state==='failed'&&<p role="alert" className="mt-2 text-xs font-bold text-rose-600">تعذر رفع الصورة. اخترها مجدداً ثم احفظ السؤال لإعادة المحاولة.</p>}{!activeUpload&&<p className="mt-2 text-xs text-slate-400">حتى 5MB. يبدأ الرفع في الخلفية فور حفظ السؤال.</p>}</div>
          <div><label className="label">نص السؤال</label><textarea className="field min-h-28 resize-y text-lg font-bold" maxLength={1000} value={question.text} onChange={(e)=>setQuestion({...question,text:e.target.value})} placeholder="اكتب السؤال بوضوح…" required /></div>
          {(question.type==='MultipleChoice'||question.type==='TrueFalse'||question.type==='Poll') && <div>
            <div className="mb-3 flex items-center justify-between"><label className="label !mb-0">الإجابات {question.type!=='Poll'&&<span className="font-normal text-slate-400">— اختر الصحيحة</span>}</label>{question.type!=='TrueFalse'&&<button type="button" onClick={addOption} className="text-sm font-black text-brand-600">＋ إضافة خيار</button>}</div>
            <div className="space-y-3">{question.options.map((option,index)=><div key={index} className="flex items-center gap-3"><button tabIndex={-1} type="button" aria-label="تعيين كإجابة صحيحة" disabled={question.type==='Poll'} onClick={()=>markCorrect(index)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 font-black ${option.isCorrect?'border-emerald-500 bg-emerald-500 text-white':'border-slate-300 text-transparent'} disabled:border-slate-200`}>✓</button><input className="field" value={option.text} onChange={(e)=>updateOption(index,e.target.value)} placeholder={`الإجابة ${index+1}`} maxLength={200} required />{question.type!=='TrueFalse'&&<button tabIndex={-1} type="button" onClick={()=>removeOption(index)} disabled={question.options.length<=2} aria-label="حذف الخيار" className="rounded-xl px-2 py-2 font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">×</button>}</div>)}</div>
          </div>}
          {question.type==='ShortAnswer'&&<div><div className="mb-3 flex justify-between"><label className="label !mb-0">الإجابات المقبولة</label><button type="button" onClick={()=>setQuestion({...question,acceptedAlternatives:[...question.acceptedAlternatives,'']})} className="text-sm font-black text-brand-600">＋ إضافة صيغة</button></div><div className="space-y-3">{question.acceptedAlternatives.map((answer,index)=><input key={index} className="field" value={answer} onChange={(e)=>setQuestion({...question,acceptedAlternatives:question.acceptedAlternatives.map((item,i)=>i===index?e.target.value:item)})} placeholder="مثال: الرياض" required={index===0} />)}</div></div>}
        </section>
        <aside className="card h-fit space-y-5 p-6">
          <h2 className="font-black">إعدادات اللعب</h2>
          <div><label className="label">وقت الإجابة</label><select className="field" value={question.durationMs} onChange={(e)=>setQuestion({...question,durationMs:Number(e.target.value)})}>{[10,15,20,30,45,60,90,120].map((seconds)=><option key={seconds} value={seconds*1000}>{seconds} ثانية</option>)}</select></div>
          {question.type!=='Poll'&&<div><label className="label">قيمة السؤال</label><select className="field" value={question.multiplier} onChange={(e)=>setQuestion({...question,multiplier:e.target.value as PointsMultiplier})}><option value="Standard">قياسي — حتى 1000</option><option value="Double">مضاعف — حتى 2000</option><option value="Zero">بدون نقاط</option></select></div>}
          <div className="rounded-2xl bg-brand-50 p-4 text-xs leading-6 text-brand-800"><b className="block text-sm">نقاط أذكى</b>الإجابة الصحيحة تحصل على 50% من القيمة على الأقل، وتزداد حتى 100% كلما كانت أسرع.</div>
        </aside>
      </div>
    </form>
  );
}

export default function QuestionsPage(){ return <AuthGuard><Suspense fallback={<PageSkeleton/>}><QuestionEditor/></Suspense></AuthGuard>; }
