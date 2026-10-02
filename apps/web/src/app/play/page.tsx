'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { registerServiceWorker } from '../../services/sw-register';
import { useSynchronizedCountdown } from '../../hooks/use-synchronized-countdown';
import { useRoomMediaPrefetch } from '../../hooks/use-room-media-prefetch';
import { Spinner } from '../../components/Loading';

type SubmissionState = 'idle' | 'submitting' | 'accepted' | 'rejected';

function PlayContent() {
  const params = useSearchParams();
  const roomId = params.get('roomId') || '';
  const code = params.get('code') || '';
  const playerId = params.get('playerId') || '';
  const nickname = params.get('nickname') || '';
  const avatar = params.get('avatar') || '';
  const validJoin = Boolean(roomId && playerId && nickname && avatar && /^\d{6}$/.test(code));

  const [snapshot, setSnapshot] = useState<any>(null);
  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submission, setSubmission] = useState<SubmissionState>('idle');
  const [rejection, setRejection] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const countdown=useSynchronizedCountdown(snapshot?.phaseEndsAt,snapshot?.serverNow);
  useRoomMediaPrefetch(roomId,snapshot?.questionIndex);

  useEffect(() => {
    if (!validJoin) {
      window.location.replace('/');
      return;
    }
    sessionStorage.setItem('brio_active_game', 'true');
    const roomSocket = new BrioRoomSocket(roomId, 'player', playerId);
    const unsubscribeSnapshot = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
      const imageUrl = data?.question?.essentialImage;
      setImageError(false);
      if (!imageUrl) setImageLoaded(true);
      else if (globalMediaPrefetchEngine.isLoaded(imageUrl)) setImageLoaded(true);
      else {
        setImageLoaded(false);
        globalMediaPrefetchEngine.queueImages([{ url:imageUrl, questionId:data.question.id, isEssential:true, priority:1 }]);
      }
    });
    const unsubscribeConnection = roomSocket.onConnectionState(setConnection);
    const unregisterServiceWorker = registerServiceWorker(() => roomSocket.connect());
    roomSocket.connect();
    setSocket(roomSocket);

    return () => {
      unsubscribeSnapshot();
      unsubscribeConnection();
      unregisterServiceWorker();
      roomSocket.close();
      sessionStorage.removeItem('brio_active_game');
      setSnapshot(null);
      setSocket(null);
      setSubmission('idle');
    };
  }, [validJoin, roomId, playerId]);

  useEffect(() => {
    setSelectedOption(null); setTextAnswer(''); setSubmission('idle'); setRejection('');
  }, [snapshot?.roundId]);

  useEffect(() => globalMediaPrefetchEngine.subscribe((states) => {
    const url = snapshot?.question?.essentialImage;
    if (!url) return;
    const state = states.get(url);
    if (state?.status === 'loaded') setImageLoaded(true);
    if (state?.status === 'error') setImageError(true);
  }), [snapshot?.question?.essentialImage]);

  if (!validJoin) return <div className="card mx-auto max-w-md p-10 text-center text-sm font-bold text-slate-500">بيانات الانضمام غير مكتملة. جاري إعادتك…</div>;

  const phase = snapshot?.phase || 'LOBBY';
  const currentQuestion = snapshot?.question;
  const roundId = snapshot?.roundId || '';
  const ownScore = snapshot?.ownScore ?? 0;
  const players = snapshot?.lobbyPlayers || [{ id:playerId, nickname, avatarId:avatar }];
  const imageBlocking = Boolean(currentQuestion?.essentialImage && !imageLoaded && !imageError);

  const submit = async (optionId?:string) => {
    if (!socket || !roundId || imageBlocking || submission === 'submitting' || submission === 'accepted') return;
    if (optionId) setSelectedOption(optionId);
    setSubmission('submitting'); setRejection('');
    try {
      await socket.submitAnswer(roundId, crypto.randomUUID(), { optionId, textAnswer:currentQuestion?.type === 'ShortAnswer' ? textAnswer : undefined });
      setSubmission('accepted');
    } catch (cause) {
      setSubmission('rejected'); setRejection(cause instanceof Error ? cause.message : 'تعذر إرسال الإجابة.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="card flex items-center justify-between p-4 sm:p-5">
        <div className="flex items-center gap-3"><img src={avatar} alt="" className="h-11 w-11 rounded-xl bg-violet-50"/><div><h1 className="font-black text-slate-900">{nickname}</h1><p className="text-xs font-bold text-slate-400">رمز اللعبة {code}</p></div></div>
        <div className="flex items-center gap-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${connection==='connected'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{connection==='connected'?'متصل':'جاري الاتصال…'}</span><div className="text-left"><span className="block text-[10px] font-bold text-slate-400">نقاطك</span><b className="text-xl text-violet-700">{ownScore}</b></div></div>
      </header>

      {phase === 'LOBBY' && (
        <section className="card relative min-h-[520px] overflow-hidden p-6 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,92,231,.12),transparent_55%)]"/>
          <div className="relative z-10 mx-auto max-w-xl pt-6"><span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">تم الانضمام بنجاح</span><h2 className="mt-4 text-3xl font-black text-slate-900">أنت في ساحة الانتظار</h2><p className="mt-2 text-slate-500">بانتظار أن يبدأ المضيف المسابقة…</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>{players.length} {players.length === 1 ? 'لاعب' : 'لاعبين'} في الساحة</div></div>
          <div className="relative z-10 mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-5 sm:grid-cols-5">
            {players.map((player:any,index:number) => <div key={player.id} className="lobby-avatar flex flex-col items-center gap-2" style={{animationDelay:`${(index%7)*-.35}s`}}><div className={`rounded-2xl border-2 bg-white p-2 shadow-lg ${player.id===playerId?'border-violet-500 shadow-violet-100':'border-white'}`}><img src={player.avatarId} alt="" className="h-14 w-14 rounded-xl sm:h-16 sm:w-16"/></div><span className="max-w-24 truncate rounded-full bg-white/90 px-2 py-1 text-xs font-black text-slate-700 shadow-sm">{player.nickname}{player.id===playerId?' (أنت)':''}</span></div>)}
          </div>
          <p className="relative z-10 mt-10 text-xs font-bold text-slate-400">ستنتقل الشاشة تلقائياً لحظة بدء المضيف.</p>
        </section>
      )}

      {phase === 'COUNTDOWN' && <section className="card grid min-h-[430px] place-items-center text-center"><div><div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-6xl font-black text-white shadow-2xl shadow-violet-200">{countdown.seconds}</div><h2 className="mt-7 text-3xl font-black">استعد!</h2><p className="mt-2 text-slate-500">المسابقة تبدأ الآن</p></div></section>}

      {phase === 'QUESTION' && currentQuestion && (
        <section className="card space-y-5 p-5 sm:p-7">
          <div className="flex items-center justify-between"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">السؤال {(snapshot.questionIndex ?? 0)+1}</span><span className="rounded-xl bg-slate-950 px-3 py-1 text-lg font-black text-white">{countdown.seconds}</span></div>
          {currentQuestion.essentialImage && <div className="relative grid min-h-44 place-items-center overflow-hidden rounded-2xl bg-slate-100">{!imageLoaded&&!imageError&&<p className="text-sm font-bold text-slate-500">جاري تحميل الصورة، وقت السؤال مستمر…</p>}<img src={currentQuestion.essentialImage} alt="صورة السؤال" onLoad={()=>setImageLoaded(true)} onError={()=>setImageError(true)} className={`max-h-72 w-full object-contain ${imageLoaded?'block':'hidden'}`}/></div>}
          <h2 className="py-3 text-center text-2xl font-black text-slate-900">{currentQuestion.text}</h2>
          {currentQuestion.options?.length>0&&<div className="grid gap-3 sm:grid-cols-2">{currentQuestion.options.map((option:any)=><button key={option.id} disabled={imageBlocking||submission==='submitting'||submission==='accepted'} onClick={()=>submit(option.id)} className={`min-h-16 rounded-2xl border-2 px-4 font-black transition ${selectedOption===option.id?'border-violet-600 bg-violet-600 text-white':'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50'} disabled:cursor-not-allowed disabled:opacity-60`}>{option.text}</button>)}</div>}
          {currentQuestion.type==='ShortAnswer'&&<div className="space-y-3"><input className="field py-4 text-center text-lg font-bold" value={textAnswer} onChange={(e)=>setTextAnswer(e.target.value)} disabled={imageBlocking||submission==='accepted'} placeholder="اكتب إجابتك…"/><button className="primary-btn w-full" onClick={()=>submit()} disabled={!textAnswer.trim()||imageBlocking||submission==='submitting'||submission==='accepted'}>إرسال الإجابة</button></div>}
          {submission==='submitting'&&<div className="rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-700"><Spinner className="ml-2 h-4 w-4"/>جاري توثيق إجابتك…</div>}
          {submission==='accepted'&&<div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">✓ تم استلام إجابتك</div>}
          {submission==='rejected'&&<div className="rounded-xl bg-rose-50 p-3 text-center text-sm font-bold text-rose-700">{rejection}</div>}
        </section>
      )}

      {(phase==='STATS'||phase==='LEADERBOARD')&&<section className="card p-8 text-center"><div className="text-5xl">{phase==='STATS'?'📊':'🏅'}</div><h2 className="mt-4 text-2xl font-black">{phase==='STATS'?'تم إغلاق السؤال':'الترتيب الحالي'}</h2><p className="mt-2 text-slate-500">نقاطك الحالية: <b className="text-violet-700">{ownScore}</b></p>{phase==='LEADERBOARD'&&<div className="mx-auto mt-6 max-w-md space-y-2">{(snapshot?.topPlayers||[]).map((player:any)=><div key={player.nickname} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold"><span>{player.rank}. {player.nickname}</span><span className="text-violet-700">{player.score}</span></div>)}</div>}</section>}
      {phase==='FINISHED'&&<section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-8 text-center text-white shadow-2xl sm:p-12"><div className="pointer-events-none absolute inset-0">{Array.from({length:18},(_,i)=><i key={i} className="confetti-piece" style={{left:`${(i*43)%100}%`,animationDelay:`-${(i%8)*.3}s`,background:['#fbbf24','#34d399','#fb7185','#fff'][i%4]}}/>)}</div><div className="relative z-10"><div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-white/10 text-6xl ring-1 ring-white/20">{(snapshot?.ownRank||99)<=3?'🏆':'✨'}</div><p className="mt-6 text-sm font-black text-violet-200">نتيجتك النهائية</p><h2 className="mt-2 text-4xl font-black">{(snapshot?.ownRank||99)===1?'أنت البطل!':(snapshot?.ownRank||99)<=3?'أداء مذهل!':'أحسنت، استمر!'}</h2><div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10"><span className="text-xs text-violet-200">ترتيبك</span><b className="mt-1 block text-4xl">#{snapshot?.ownRank||'—'}</b></div><div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10"><span className="text-xs text-violet-200">مجموع النقاط</span><b className="mt-1 block text-3xl">{ownScore.toLocaleString('ar')}</b></div></div><p className="mx-auto mt-6 max-w-md text-sm leading-7 text-violet-100">شكراً لمشاركتك. كل إجابة صحيحة أضيفت إلى مجموعك التراكمي عبر جميع الجولات.</p><a href="/" className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-black text-violet-700 shadow-xl">العودة للرئيسية</a></div></section>}
    </div>
  );
}

export default function PlayPage(){ return <Suspense fallback={<div className="card mx-auto max-w-md p-10 text-center">جاري تجهيز اللعبة…</div>}><PlayContent/></Suspense>; }
