'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { AuthGuard } from '../../components/AuthGuard';

function HostContent() {
  const params = useSearchParams();
  const roomId = params.get('roomId') || '';
  const requestedCode = params.get('code') || '';
  const [snapshot,setSnapshot] = useState<any>(null);
  const [socket,setSocket] = useState<BrioRoomSocket|null>(null);
  const [connection,setConnection] = useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [error,setError] = useState<string|null>(null);
  const [ending,setEnding] = useState(false);

  useEffect(() => {
    if (!roomId) { window.location.replace('/dashboard/'); return; }
    const roomSocket = new BrioRoomSocket(roomId,'host');
    const offSnapshot = roomSocket.onSnapshot(setSnapshot);
    const offConnection = roomSocket.onConnectionState(setConnection);
    roomSocket.connect(); setSocket(roomSocket);
    return () => { offSnapshot(); offConnection(); roomSocket.close(); setSocket(null); setSnapshot(null); };
  },[roomId]);

  const phase = snapshot?.phase || 'LOBBY';
  const code = /^\d{6}$/.test(snapshot?.code || '') ? snapshot.code : requestedCode;
  const players = snapshot?.lobbyPlayers || [];
  const start = () => {
    if (!socket || connection!=='connected') return setError('الاتصال بالغرفة غير جاهز بعد.');
    if (players.length===0) return setError('انتظر انضمام لاعب واحد على الأقل.');
    setError(null); socket.startQuiz();
  };
  const endRoom = async () => {
    if (!roomId || !window.confirm('هل تريد إنهاء هذه اللعبة؟ سيتم إخراج جميع اللاعبين.')) return;
    setEnding(true); setError(null);
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { method:'DELETE', credentials:'same-origin' });
    const body = await response.json().catch(()=>null);
    if (!response.ok) { setEnding(false); setError(body?.detail || 'تعذر إنهاء اللعبة.'); return; }
    window.location.assign('/dashboard/');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">لوحة المضيف</span><h1 className="mt-3 text-2xl font-black">ساحة المسابقة</h1><p className="mt-1 text-sm text-slate-500">{connection==='connected'?'متصل وجاهز لاستقبال اللاعبين':'جاري الاتصال بالغرفة…'}</p></div>
        <div className="flex items-center gap-3"><button onClick={endRoom} disabled={ending||phase==='FINISHED'} className="rounded-xl px-3 py-2 text-sm font-black text-rose-600 hover:bg-rose-50">{ending?'جاري الإنهاء…':'إنهاء اللعبة'}</button><div className="rounded-2xl bg-slate-900 px-7 py-3 text-center text-white"><span className="block text-[11px] font-bold text-slate-300">رمز الانضمام</span><b className="text-3xl tracking-[.22em]">{code || '------'}</b></div></div>
      </header>
      {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      {phase==='LOBBY'&&<section className="card min-h-[520px] overflow-hidden p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black">اللاعبون في الانتظار</h2><p className="mt-1 text-sm text-slate-500">سيظهر كل لاعب هنا فور انضمامه.</p></div><button onClick={start} disabled={connection!=='connected'||players.length===0} className="primary-btn">بدء المسابقة الآن</button></div>
        <div className="relative min-h-[390px] pt-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,92,231,.10),transparent_55%)]"/>
          {players.length===0?<div className="relative z-10 grid min-h-[320px] place-items-center text-center"><div><div className="text-5xl">👋</div><h3 className="mt-4 text-xl font-black">بانتظار أول لاعب</h3><p className="mt-2 text-sm text-slate-500">شارك الرمز <b className="text-violet-700">{code}</b> مع جمهورك.</p></div></div>:
          <div className="relative z-10 grid grid-cols-3 gap-6 sm:grid-cols-5 lg:grid-cols-7">{players.map((player:any,index:number)=><div key={player.id} className="lobby-avatar flex flex-col items-center gap-2" style={{animationDelay:`${(index%8)*-.3}s`}}><div className="rounded-2xl border-2 border-white bg-white p-2 shadow-xl"><img src={player.avatarId} alt="" className="h-16 w-16 rounded-xl"/></div><span className="max-w-28 truncate rounded-full bg-white px-2 py-1 text-xs font-black text-slate-700 shadow-sm">{player.nickname}</span></div>)}</div>}
        </div>
        <div className="text-center text-sm font-black text-slate-500">{players.length} {players.length===1?'لاعب جاهز':'لاعبين جاهزين'}</div>
      </section>}

      {phase==='COUNTDOWN'&&<section className="card grid min-h-[450px] place-items-center text-center"><div><div className="text-7xl">🚀</div><h2 className="mt-5 text-4xl font-black">انطلقت المسابقة</h2><p className="mt-2 text-slate-500">يستعد جميع اللاعبين في اللحظة نفسها.</p></div></section>}
      {phase==='QUESTION'&&snapshot?.question&&<section className="card p-8"><div className="flex justify-between text-xs font-black"><span className="text-violet-700">السؤال {(snapshot.questionIndex??0)+1}</span><span className="text-rose-600">● مباشر</span></div><h2 className="mx-auto mt-12 max-w-3xl text-center text-4xl font-black leading-relaxed">{snapshot.question.text}</h2><div className="mt-12 text-center text-sm font-bold text-slate-500">تم استلام {snapshot.acceptedAnswersCount||0} إجابة من {players.length}</div></section>}
      {(phase==='STATS'||phase==='LEADERBOARD')&&<section className="card p-14 text-center"><div className="text-6xl">{phase==='STATS'?'📊':'🏅'}</div><h2 className="mt-5 text-3xl font-black">{phase==='STATS'?'إحصاءات الإجابات':'الترتيب الحالي'}</h2><p className="mt-2 text-slate-500">ستنتقل اللعبة تلقائياً إلى المرحلة التالية.</p></section>}
      {phase==='FINISHED'&&<section className="card p-14 text-center"><div className="text-7xl">🏆</div><h2 className="mt-5 text-4xl font-black">انتهت المسابقة!</h2><a href="/dashboard/" className="primary-btn mt-7 inline-block">العودة لمسابقاتي</a></section>}
    </div>
  );
}

export default function HostPage(){ return <AuthGuard><Suspense fallback={<div className="card p-12 text-center">جاري فتح غرفة المضيف…</div>}><HostContent/></Suspense></AuthGuard>; }
