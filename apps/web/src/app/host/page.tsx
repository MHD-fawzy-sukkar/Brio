'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { AuthGuard } from '../../components/AuthGuard';
import { PageSkeleton } from '../../components/Loading';
import { Podium } from '../../components/Podium';
import { useSynchronizedCountdown } from '../../hooks/use-synchronized-countdown';
import { useRoomMediaPrefetch } from '../../hooks/use-room-media-prefetch';
import { Avatar } from '../../components/Avatar';
import { GameControls } from '../../components/host-lobby/GameControls';
import { HostLobby } from '../../components/host-lobby/HostLobby';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';

const optionColors=['bg-brand-500','bg-cyan-500','bg-amber-500','bg-emerald-500','bg-blue-500','bg-orange-500'];

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
  return <div data-bolt-flight-root className="relative mx-auto max-w-6xl space-y-5">
    {phase==='LOBBY'&&<RoamingBolt />}
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

    {phase!=='LOBBY'&&<GameControls quizTitle={snapshot.quizTitle} connected={connection==='connected'} players={players} onEnd={endRoom} ending={ending} finished={phase==='FINISHED'}/>}
    {phase==='LOBBY'&&<HostLobby quizTitle={snapshot.quizTitle} code={code} connected={connection==='connected'} players={players} onStart={start} onEnd={endRoom} ending={ending}/>}

    {phase==='COUNTDOWN'&&<section className="card grid min-h-[480px] place-items-center text-center"><div><div className="mx-auto grid h-36 w-36 place-items-center rounded-full border-4 border-brand-100 bg-brand-50 text-7xl font-black text-brand-700 shadow-xl shadow-brand-100">{countdown.seconds}</div><h2 className="mt-7 text-4xl font-black">استعدوا للانطلاق!</h2></div></section>}

    {phase==='QUESTION'&&question&&<section className="card overflow-hidden"><div className="h-2 bg-slate-100"><div className="h-full bg-gradient-to-l from-brand-500 to-cyan-400 transition-all" style={{width:`${Math.min(100,countdown.remainingMs/question.durationMs*100)}%`}}/></div><div className="p-4 sm:p-8"><div className="flex items-center justify-between"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">السؤال {(snapshot.questionIndex??0)+1}</span><div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-2 text-2xl font-black text-amber-700">{countdown.seconds}</div></div>{question.essentialImage&&<div className="mx-auto mt-6 grid max-h-72 min-h-40 place-items-center rounded-2xl bg-slate-50"><img src={question.essentialImage} alt="صورة السؤال" className="max-h-72 w-full object-contain p-3"/></div>}<h2 className="mx-auto mt-7 max-w-4xl text-center text-2xl font-black leading-relaxed sm:text-4xl">{question.text}</h2>{question.options?.length>0&&<div className="mt-8 grid gap-3 sm:grid-cols-2">{question.options.map((option:any,index:number)=><div key={option.id} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-black"><span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${optionColors[index%optionColors.length]}`}>{index+1}</span>{option.text}</div>)}</div>}<div aria-live="polite" className="mx-auto mt-7 max-w-sm rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center"><b className="text-2xl text-brand-800">{snapshot.acceptedAnswersCount??0}</b><span className="mx-2 text-sm font-bold text-brand-500">من</span><b className="text-2xl text-brand-800">{snapshot.playerCount??players.length}</b><span className="mt-1 block text-xs font-bold text-slate-500">إجابة وصلت حتى الآن</span></div></div></section>}

    {phase==='STATS'&&<section className="card p-6 sm:p-9"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-brand-600">انتهى الوقت</p><h2 className="mt-1 text-3xl font-black">توزيع الإجابات</h2></div><div className="rounded-2xl bg-brand-50 px-5 py-3 text-center"><b className="text-2xl text-brand-700">{countdown.seconds}</b><span className="block text-[10px] font-bold text-slate-400">للترتيب</span></div></div><div className="mt-8 space-y-4">{(snapshot.answerStats||[]).map((stat:any,index:number)=><div key={`${stat.optionId}-${index}`}><div className="mb-2 flex justify-between text-sm font-bold"><span>{stat.label}{stat.isCorrect===true?' ✓':''}</span><span>{stat.count} · {stat.percentage}%</span></div><div className="h-10 overflow-hidden rounded-xl bg-slate-100"><div className={`flex h-full items-center px-3 text-xs font-black text-white transition-all ${stat.isCorrect===true?'bg-emerald-500':optionColors[index%optionColors.length]}`} style={{width:`${Math.max(stat.percentage,stat.count?8:0)}%`}}>{stat.percentage>12?`${stat.percentage}%`:''}</div></div></div>)}</div></section>}

    {phase==='LEADERBOARD'&&<section data-bolt-flight-root className="card relative p-6 sm:p-9"><RoamingBolt scope="page" celebration/><div className="text-center"><div className="text-5xl">🏅</div><h2 className="mt-3 text-3xl font-black">الترتيب الحالي</h2><p className="mt-1 text-sm text-slate-500">هذه النقاط تراكمية، وكل سؤال جديد قد يغيّر الترتيب.</p></div><div data-bolt-flight-boundary className="mx-auto mt-8 max-w-2xl space-y-3">{(snapshot.leaderboard||[]).map((player:any)=><div key={player.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3"><b className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">#{player.rank}</b><Avatar src={player.avatarId} label={player.nickname} className="h-11 w-11 rounded-xl"/><span className="flex-1 font-black">{player.nickname}</span><strong className="text-brand-700">{player.score.toLocaleString('ar')}</strong></div>)}</div></section>}

    {phase==='FINISHED'&&<div className="space-y-5"><Podium players={snapshot.leaderboard||[]}/><div className="text-center"><a href="/dashboard/" className="primary-btn inline-block">العودة إلى مسابقاتي</a></div></div>}
  </div>;
}

export default function HostPage(){return <AuthGuard><Suspense fallback={<PageSkeleton/>}><HostContent/></Suspense></AuthGuard>;}
