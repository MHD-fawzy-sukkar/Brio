'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, STATIC_AVATARS } from '../../components/Avatar';
import { PageSkeleton } from '../../components/Loading';

const AVATARS = STATIC_AVATARS;

function JoinSetup() {
  const params = useSearchParams();
  const directRoomId = params.get('roomId') || '';
  const directCode = params.get('code') || '';
  const pin = (params.get('pin') || '').replace(/\D/g,'').slice(0,6);
  const [roomId,setRoomId]=useState(directRoomId);
  const [code,setCode]=useState(directCode || pin);
  const [resolving,setResolving]=useState(!directRoomId);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if(directRoomId&&/^\d{6}$/.test(directCode)){setResolving(false);return;}
    if(!/^\d{6}$/.test(pin)){setError('رابط الانضمام غير مكتمل. اطلب من المضيف رمزاً جديداً.');setResolving(false);return;}
    const controller=new AbortController(); requestRef.current=controller; setResolving(true); setError(null);
    fetch(`/api/rooms/by-code/${encodeURIComponent(pin)}`,{signal:controller.signal}).then(async(response)=>{
      const room=await response.json().catch(()=>null);
      if(!response.ok||!room?.roomId)throw new Error('لم نجد لعبة نشطة بهذا الرمز. تحقق منه وحاول مجدداً.');
      setRoomId(room.roomId);setCode(pin);
    }).catch((cause)=>{if((cause as Error)?.name!=='AbortError')setError(cause instanceof Error?cause.message:'تعذر تجهيز رابط الانضمام.');}).finally(()=>setResolving(false));
    return () => { controller.abort(); if(requestRef.current===controller)requestRef.current=null; };
  }, [directRoomId,directCode,pin]);

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId || !code) return;
    if (nickname.trim().length < 2) return setError('اكتب اسماً من حرفين على الأقل.');
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setJoining(true); setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), avatarId: avatar })
      });
      const player = await response.json().catch(() => null);
      if (response.status === 404) throw new Error('انتهت اللعبة أو لم تعد متاحة.');
      if (!response.ok || !player?.playerId) throw new Error(player?.detail || 'تعذر الانضمام إلى اللعبة.');
      sessionStorage.setItem(`brio_player_session:${roomId}:${player.playerId}`,player.sessionToken);
      const query = new URLSearchParams({ roomId, code, playerId: player.playerId, nickname: player.nickname, avatar: player.avatarId });
      window.location.assign(`/play/?${query}`);
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'تعذر الانضمام.');
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setJoining(false); }
    }
  };

  if(resolving)return <PageSkeleton/>;
  if(!roomId||!code)return <div className="card mx-auto max-w-lg p-10 text-center"><div className="text-5xl">🔎</div><h1 className="mt-4 text-xl font-black">تعذر فتح رابط اللعبة</h1><p className="mt-2 text-sm font-bold leading-7 text-rose-600">{error}</p><a href="/" className="secondary-btn mt-6 inline-block">إدخال الرمز يدوياً</a></div>;

  return (
    <div className="mx-auto flex min-h-[72vh] max-w-4xl items-center justify-center py-8">
      <section className="card grid w-full overflow-hidden lg:grid-cols-[.85fr_1.15fr]">
        <div className="flex flex-col justify-between border-b border-brand-100 bg-gradient-to-br from-brand-50 to-cyan-50 p-8 text-slate-900 sm:p-10 lg:border-b-0 lg:border-l">
          <div><span className="text-xs font-black text-brand-600">رمز اللعبة</span><div className="mt-2 text-4xl font-black tracking-[.22em] text-brand-800" dir="ltr">{code}</div></div>
          <div className="mt-12"><div className="text-5xl">👋</div><h1 className="mt-4 text-3xl font-black">اختر شخصيتك</h1><p className="mt-3 leading-7 text-slate-600">اكتب اسماً لطيفاً واختر الصورة التي سترافقك في التحدي.</p></div>
        </div>
        <form onSubmit={join} className="space-y-6 p-7 sm:p-10">
          <div><h2 className="text-xl font-black text-slate-900">جاهز للدخول؟</h2><p className="mt-1 text-sm text-slate-500">يمكنك تعديل الاسم والصورة قبل الانضمام.</p></div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
          <div><label htmlFor="nickname" className="label">الاسم المستعار</label><input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={24} autoFocus className="field" placeholder="مثال: نور" /></div>
          <fieldset><legend className="label">اختر صورتك</legend><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{AVATARS.map((item, index) => <button key={item} type="button" onClick={() => setAvatar(item)} aria-label={`الصورة ${index + 1}`} aria-pressed={avatar === item} className={`rounded-2xl border-2 p-1.5 transition ${avatar === item ? 'scale-105 border-brand-500 bg-brand-50 shadow-md' : 'border-slate-100 hover:border-brand-200'}`}><Avatar src={item} className="w-full rounded-xl" /></button>)}</div></fieldset>
          <button type="submit" disabled={joining || nickname.trim().length < 2} className="primary-btn w-full py-3.5">{joining ? 'لحظة، نجهّز مكانك…' : 'انضم إلى اللعبة'}</button>
          <a href="/" className="block text-center text-sm font-bold text-slate-500 hover:text-brand-600">استخدام رمز مختلف</a>
        </form>
      </section>
    </div>
  );
}

export default function JoinPage() {
  return <Suspense fallback={<div className="card mx-auto max-w-lg p-12 text-center text-slate-500">جاري تجهيز الغرفة…</div>}><JoinSetup /></Suspense>;
}
