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
  return <div className="mx-auto max-w-xl rounded-[2rem] border border-violet-100 bg-gradient-to-br from-white via-violet-50 to-amber-50 p-8 text-center text-slate-900 shadow-2xl shadow-violet-100/60 sm:p-10"><div className="text-7xl">{snapshot.ownRank<=3?'🏆':'✨'}</div><h1 className="mt-5 text-4xl font-black text-violet-950">{snapshot.ownRank===1?'أنت بطل الجولة!':'أحسنت اللعب!'}</h1><p className="mt-2 text-sm font-bold text-slate-500">هذه نتيجتك النهائية بعد جمع نقاط جميع الأسئلة.</p><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><small className="font-bold text-slate-500">الترتيب</small><b className="mt-1 block text-4xl text-violet-700">#{snapshot.ownRank||'—'}</b></div><div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"><small className="font-bold text-slate-500">النقاط</small><b className="mt-1 block text-3xl text-amber-600">{snapshot.ownScore?.toLocaleString('ar')}</b></div></div><a href="/" className="primary-btn mt-8 inline-block">العودة إلى الصفحة الرئيسية</a></div>;
}

export default function ResultsPage(){return <Suspense fallback={<PageSkeleton/>}><ResultsContent/></Suspense>;}
