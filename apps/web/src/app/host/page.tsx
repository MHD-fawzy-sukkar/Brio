'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { AuthGuard } from '../../components/AuthGuard';
import { ButtonContent, PageSkeleton } from '../../components/Loading';
import { Podium } from '../../components/Podium';
import { useSynchronizedCountdown } from '../../hooks/use-synchronized-countdown';
import { useRoomMediaPrefetch } from '../../hooks/use-room-media-prefetch';
import { Avatar } from '../../components/Avatar';
import { JoinQrCode } from '../../components/JoinQrCode';

const optionColors=['bg-violet-500','bg-cyan-500','bg-amber-500','bg-rose-500','bg-emerald-500','bg-indigo-500'];

function HostContent(){
  const params=useSearchParams();
  const roomId=params.get('roomId')||'';
  const requestedCode=params.get('code')||'';
  const [snapshot,setSnapshot]=useState<any>(null);
  const [socket,setSocket]=useState<BrioRoomSocket|null>(null);
  const [connection,setConnection]=useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [error,setError]=useState<string|null>(null);
  const [ending,setEnding]=useState(false);
  const phase=snapshot?.phase||'LOBBY';
  const players=snapshot?.lobbyPlayers||[];
  const question=snapshot?.question;
  const countdown=useSynchronizedCountdown(snapshot?.phaseEndsAt,snapshot?.serverNow);
  useRoomMediaPrefetch(roomId,snapshot?.questionIndex);

  useEffect(()=>{
    if(!roomId){window.location.replace('/dashboard/');return;}
    const roomSocket=new BrioRoomSocket(roomId,'host');
    const offSnapshot=roomSocket.onSnapshot(setSnapshot);
    const offConnection=roomSocket.onConnectionState(setConnection);
    roomSocket.connect();setSocket(roomSocket);
    return()=>{offSnapshot();offConnection();roomSocket.close();setSocket(null);setSnapshot(null);};
  },[roomId]);

  const start=()=>{
    if(!socket||connection!=='connected')return setError('الاتصال بالغرفة غير جاهز بعد.');
    if(players.length===0)return setError('انتظر انضمام لاعب واحد على الأقل.');
    setError(null);socket.startQuiz();
  };
  const endRoom=async()=>{
    if(!roomId||!window.confirm('هل تريد إنهاء هذه اللعبة؟ سيتم إخراج جميع اللاعبين.'))return;
    setEnding(true);setError(null);
    const response=await fetch(`/api/rooms/${encodeURIComponent(roomId)}`,{method:'DELETE',credentials:'same-origin'});
    const body=await response.json().catch(()=>null);
    if(!response.ok){setEnding(false);setError(body?.detail||'تعذر إنهاء اللعبة.');return;}
    window.location.assign('/dashboard/');
  };
  const code=/^\d{6}$/.test(snapshot?.code||'')?snapshot.code:requestedCode;

  if(!snapshot)return <PageSkeleton/>;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5"><div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">لوحة المضيف · {phase}</span><h1 className="mt-3 text-2xl font-black">ساحة المسابقة</h1><p className="mt-1 text-sm text-slate-500">{connection==='connected'?'متصل ومتزامن مع اللاعبين':'نعيد الاتصال بالغرفة…'}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><button onClick={endRoom} disabled={ending||phase==='FINISHED'} className="rounded-xl px-3 py-2 text-sm font-black text-rose-600 hover:bg-rose-50"><ButtonContent busy={ending} busyText="جاري الإنهاء…">إنهاء اللعبة</ButtonContent></button>{phase==='LOBBY'&&<div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-center text-violet-900"><span className="block text-[11px] font-bold text-violet-500">رمز الانضمام</span><b className="text-2xl tracking-[.22em] sm:text-3xl">{code||'------'}</b></div>}</div></header>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

    {phase==='LOBBY'&&<section className="card min-h-[520px] overflow-hidden p-4 sm:p-6"><div className="grid gap-6 lg:grid-cols-[1fr_260px]"><div><div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black">غرفة الانتظار</h2><p className="mt-1 text-sm text-slate-500">يظهر اللاعبون فور انضمامهم، ويمكن للمتأخرين اللحاق باللعبة بعد البدء.</p></div><button onClick={start} disabled={connection!=='connected'||players.length===0} className="primary-btn w-full py-3.5 sm:w-auto">بدء المسابقة الآن</button></div><div className="relative min-h-[390px] pt-8">{players.length===0?<div className="grid min-h-[320px] place-items-center text-center"><div><div className="text-5xl">👋</div><h3 className="mt-4 text-xl font-black">بانتظار أول لاعب</h3><p className="mt-2 text-sm text-slate-500">شارك الرمز أو دع اللاعبين يمسحون QR.</p></div></div>:<div className="grid grid-cols-3 gap-5 sm:grid-cols-5">{players.map((player:any,index:number)=><div key={player.id} className="lobby-avatar flex min-w-0 flex-col items-center gap-2" style={{animationDelay:`${(index%8)*-.3}s`}}><div className="rounded-2xl border border-violet-50 bg-white p-2 shadow-lg"><Avatar src={player.avatarId} label={player.nickname} className="h-14 w-14 rounded-xl sm:h-16 sm:w-16"/></div><span className="max-w-full truncate text-xs font-black">{player.nickname}</span></div>)}</div>}</div><div className="text-center text-sm font-black text-slate-500">{players.length} {players.length===1?'لاعب جاهز':'لاعبون جاهزون'}</div></div><JoinQrCode pin={code}/></div></section>}

    {phase==='COUNTDOWN'&&<section className="card grid min-h-[480px] place-items-center text-center"><div><div className="mx-auto grid h-36 w-36 place-items-center rounded-full border-4 border-violet-100 bg-violet-50 text-7xl font-black text-violet-700 shadow-xl shadow-violet-100">{countdown.seconds}</div><h2 className="mt-7 text-4xl font-black">استعدوا للانطلاق!</h2></div></section>}

    {phase==='QUESTION'&&question&&<section className="card overflow-hidden"><div className="h-2 bg-slate-100"><div className="h-full bg-gradient-to-l from-violet-500 to-cyan-400 transition-all" style={{width:`${Math.min(100,countdown.remainingMs/question.durationMs*100)}%`}}/></div><div className="p-4 sm:p-8"><div className="flex items-center justify-between"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">السؤال {(snapshot.questionIndex??0)+1}</span><div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-2 text-2xl font-black text-amber-700">{countdown.seconds}</div></div>{question.essentialImage&&<div className="mx-auto mt-6 grid max-h-72 min-h-40 place-items-center rounded-2xl bg-slate-50"><img src={question.essentialImage} alt="صورة السؤال" className="max-h-72 w-full object-contain p-3"/></div>}<h2 className="mx-auto mt-7 max-w-4xl text-center text-2xl font-black leading-relaxed sm:text-4xl">{question.text}</h2>{question.options?.length>0&&<div className="mt-8 grid gap-3 sm:grid-cols-2">{question.options.map((option:any,index:number)=><div key={option.id} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-black"><span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${optionColors[index%optionColors.length]}`}>{index+1}</span>{option.text}</div>)}</div>}<div aria-live="polite" className="mx-auto mt-7 max-w-sm rounded-2xl border border-violet-100 bg-violet-50 p-4 text-center"><b className="text-2xl text-violet-800">{snapshot.acceptedAnswersCount??0}</b><span className="mx-2 text-sm font-bold text-violet-500">من</span><b className="text-2xl text-violet-800">{snapshot.playerCount??players.length}</b><span className="mt-1 block text-xs font-bold text-slate-500">إجابة وصلت حتى الآن</span></div></div></section>}

    {phase==='STATS'&&<section className="card p-6 sm:p-9"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-violet-600">انتهى الوقت</p><h2 className="mt-1 text-3xl font-black">توزيع الإجابات</h2></div><div className="rounded-2xl bg-violet-50 px-5 py-3 text-center"><b className="text-2xl text-violet-700">{countdown.seconds}</b><span className="block text-[10px] font-bold text-slate-400">للترتيب</span></div></div><div className="mt-8 space-y-4">{(snapshot.answerStats||[]).map((stat:any,index:number)=><div key={`${stat.optionId}-${index}`}><div className="mb-2 flex justify-between text-sm font-bold"><span>{stat.label}{stat.isCorrect===true?' ✓':''}</span><span>{stat.count} · {stat.percentage}%</span></div><div className="h-10 overflow-hidden rounded-xl bg-slate-100"><div className={`flex h-full items-center px-3 text-xs font-black text-white transition-all ${stat.isCorrect===true?'bg-emerald-500':optionColors[index%optionColors.length]}`} style={{width:`${Math.max(stat.percentage,stat.count?8:0)}%`}}>{stat.percentage>12?`${stat.percentage}%`:''}</div></div></div>)}</div></section>}

    {phase==='LEADERBOARD'&&<section className="card p-6 sm:p-9"><div className="text-center"><div className="text-5xl">🏅</div><h2 className="mt-3 text-3xl font-black">الترتيب الحالي</h2><p className="mt-1 text-sm text-slate-500">هذه النقاط تراكمية، وكل سؤال جديد قد يغيّر الترتيب.</p></div><div className="mx-auto mt-8 max-w-2xl space-y-3">{(snapshot.leaderboard||[]).map((player:any)=><div key={player.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3"><b className="grid h-10 w-10 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">#{player.rank}</b><Avatar src={player.avatarId} label={player.nickname} className="h-11 w-11 rounded-xl"/><span className="flex-1 font-black">{player.nickname}</span><strong className="text-violet-700">{player.score.toLocaleString('ar')}</strong></div>)}</div></section>}

    {phase==='FINISHED'&&<div className="space-y-5"><Podium players={snapshot.leaderboard||[]}/><div className="text-center"><a href="/dashboard/" className="primary-btn inline-block">العودة إلى مسابقاتي</a></div></div>}
  </div>;
}

export default function HostPage(){return <AuthGuard><Suspense fallback={<PageSkeleton/>}><HostContent/></Suspense></AuthGuard>;}
