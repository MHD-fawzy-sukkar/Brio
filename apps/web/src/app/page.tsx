'use client';

import { useEffect, useRef, useState } from 'react';

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
    <div className="relative mx-auto flex min-h-[72vh] max-w-6xl items-center justify-center overflow-hidden py-8">
      <div className="absolute right-8 top-8 h-52 w-52 rounded-full bg-violet-200/50 blur-3xl" />
      <div className="absolute bottom-6 left-6 h-52 w-52 rounded-full bg-amber-200/50 blur-3xl" />
      <section className="relative grid w-full overflow-hidden rounded-[2rem] border border-white bg-white/90 shadow-2xl shadow-violet-100/70 lg:grid-cols-[1.1fr_.9fr]">
        <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 p-9 text-white sm:p-14">
          <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black ring-1 ring-white/20">لعب حي وتفاعل فوري</span>
          <h1 className="mt-7 text-4xl font-black leading-tight sm:text-5xl">مسابقتك تبدأ<br />برمز واحد.</h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-violet-100 sm:text-lg">أدخل PIN اللعبة الآن. ستختار اسمك وصورتك في الخطوة التالية قبل دخول غرفة الانتظار.</p>
          <div className="mt-10 flex flex-wrap gap-6 text-sm font-bold text-violet-100"><span>✓ دخول فوري</span><span>✓ بلا تسجيل</span><span>✓ نتائج مباشرة</span></div>
        </div>
        <div className="flex items-center p-7 sm:p-12">
          <form onSubmit={continueToLobby} className="w-full space-y-6">
            <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-2xl">🎮</div><h2 className="mt-4 text-2xl font-black text-slate-900">انضم إلى اللعبة</h2><p className="mt-2 text-sm text-slate-500">يمكنك الحصول على الرمز من مقدّم المسابقة</p></div>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
            <div><label htmlFor="game-pin" className="label">رمز اللعبة (PIN)</label><input id="game-pin" value={code} onChange={(event) => setCode(normalizePin(event.target.value))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="field py-4 text-center text-3xl font-black tracking-[.32em] placeholder:tracking-[.18em] placeholder:text-slate-300" /></div>
            <button type="submit" disabled={checking || code.length !== 6} className="primary-btn w-full py-3.5 text-base">{checking ? 'جاري التحقق…' : 'متابعة'}</button>
            <p className="text-center text-xs text-slate-400">هل تريد إنشاء مسابقة؟ <a href="/login/" className="font-black text-violet-600 hover:underline">دخول المنشئين</a></p>
          </form>
        </div>
      </section>
    </div>
  );
}
