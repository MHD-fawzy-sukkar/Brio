'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Podium } from '../../components/Podium';
import { PageSkeleton } from '../../components/Loading';

function ResultsContent(){
  const params=useSearchParams();
  const roomId=params.get('roomId')||'';
  const playerId=params.get('playerId')||'';
  const [snapshot,setSnapshot]=useState<any>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    if(!roomId){setError('معرّف الغرفة مفقود.');return;}
    const query=playerId?`?playerId=${encodeURIComponent(playerId)}`:'';
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/snapshot${query}`).then(async(response)=>{
      const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.detail||'تعذر تحميل النتائج.');setSnapshot(body);
    }).catch((cause)=>setError(cause instanceof Error?cause.message:'تعذر تحميل النتائج.'));
  },[roomId,playerId]);
  if(error)return <div className="card mx-auto max-w-lg p-10 text-center font-bold text-rose-600">{error}</div>;
  if(!snapshot)return <PageSkeleton/>;
  if(snapshot.role==='host')return <div className="mx-auto max-w-6xl space-y-6"><Podium players={snapshot.leaderboard||[]}/><div className="text-center"><a className="primary-btn inline-block" href="/dashboard/">العودة للوحة التحكم</a></div></div>;
  return <div className="mx-auto max-w-xl rounded-[2rem] bg-gradient-to-br from-violet-700 to-slate-950 p-10 text-center text-white shadow-2xl"><div className="text-7xl">{snapshot.ownRank<=3?'🏆':'✨'}</div><h1 className="mt-5 text-4xl font-black">{snapshot.ownRank===1?'أنت البطل!':'أحسنت اللعب!'}</h1><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-5"><small>الترتيب</small><b className="mt-1 block text-4xl">#{snapshot.ownRank||'—'}</b></div><div className="rounded-2xl bg-white/10 p-5"><small>النقاط</small><b className="mt-1 block text-3xl">{snapshot.ownScore?.toLocaleString('ar')}</b></div></div><a href="/" className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-black text-violet-700">العودة للرئيسية</a></div>;
}

export default function ResultsPage(){return <Suspense fallback={<PageSkeleton/>}><ResultsContent/></Suspense>;}
