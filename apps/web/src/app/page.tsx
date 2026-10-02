'use client';

import { useEffect, useRef, useState } from 'react';
import { ButtonContent } from '../components/Loading';

function normalizePin(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '').slice(0, 6);
}

export default function HomePage() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);

  const continueToLobby = async (event: React.FormEvent) => {
    event.preventDefault();
    const pin = normalizePin(code);
    if (pin.length !== 6) return setError('أدخل رمز اللعبة المكوّن من 6 أرقام.');
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setChecking(true); setError(null);
    try {
      const response = await fetch(`/api/rooms/by-code/${encodeURIComponent(pin)}`, { signal: controller.signal });
      const room = await response.json().catch(() => null);
      if (response.status === 404) throw new Error('اللعبة غير موجودة. تحقق من الرمز وحاول مرة أخرى.');
      if (!response.ok || !room?.roomId) throw new Error(room?.detail || 'تعذر التحقق من رمز اللعبة.');
      window.location.assign(`/join/?${new URLSearchParams({ roomId: room.roomId, code: pin })}`);
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'تعذر العثور على اللعبة.');
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setChecking(false); }
    }
  };

  return (
    <div className="relative mx-auto min-h-[76vh] max-w-7xl overflow-hidden rounded-[2.5rem] bg-slate-950 px-5 py-8 shadow-2xl shadow-violet-200/50 sm:px-10 lg:py-12">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl"/><div className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"/>
      <section className="relative z-10 grid min-h-[65vh] items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="text-white"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-cyan-200 ring-1 ring-white/15"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/>مسابقات حية في الوقت الحقيقي</span><h1 className="mt-7 text-5xl font-black leading-[1.15] sm:text-6xl">حوّل كل سؤال<br/><span className="bg-gradient-to-l from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent">إلى لحظة حماس.</span></h1><p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">ادخل بالرمز، اختر شخصيتك، وتنافس مع الجميع. نقاط تراكمية، ترتيب مباشر، ونهاية لا تُنسى.</p><div className="mt-8 flex flex-wrap gap-3">{['⚡ دخول فوري','🏆 ترتيب حي','🎨 تجربة مبهجة'].map((item)=><span key={item} className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 ring-1 ring-white/10">{item}</span>)}</div><div className="relative mt-10 hidden h-28 max-w-lg lg:block"><div className="absolute right-2 top-2 grid h-24 w-24 rotate-6 place-items-center rounded-[2rem] bg-gradient-to-br from-amber-300 to-orange-500 text-5xl shadow-xl">🤩</div><div className="absolute right-24 top-8 rounded-2xl rounded-br-sm bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-xl">جاهز للتحدي؟</div></div></div>
        <div className="rounded-[2rem] bg-white p-6 shadow-2xl sm:p-9"><form onSubmit={continueToLobby} className="space-y-6">
            <div className="text-center"><div className="mx-auto grid h-16 w-16 -rotate-3 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl text-white shadow-lg shadow-violet-200">🎮</div><h2 className="mt-5 text-3xl font-black text-slate-900">ادخل ساحة اللعب</h2><p className="mt-2 text-sm text-slate-500">اكتب رمز PIN الذي شاركه المضيف</p></div>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
            <div><label htmlFor="game-pin" className="label">رمز اللعبة (PIN)</label><input id="game-pin" value={code} onChange={(event) => setCode(normalizePin(event.target.value))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="field py-4 text-center text-3xl font-black tracking-[.32em] placeholder:tracking-[.18em] placeholder:text-slate-300" /></div>
            <button type="submit" disabled={checking || code.length !== 6} className="primary-btn w-full py-4 text-base"><ButtonContent busy={checking} busyText="جاري التحقق…">متابعة إلى شخصيتك</ButtonContent></button>
            <p className="text-center text-xs text-slate-400">هل تريد إنشاء مسابقة؟ <a href="/login/" className="font-black text-violet-600 hover:underline">دخول المنشئين</a></p>
          </form></div>
      </section>
    </div>
  );
}
