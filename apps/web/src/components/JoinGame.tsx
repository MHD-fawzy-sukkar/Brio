'use client';

import { useEffect, useRef, useState } from 'react';
import { ButtonContent } from './Loading';
import { AmbientBackground } from './AmbientBackground';
import { MarketingHero } from './MarketingHero';
import { normalizePin } from '../services/home-routing';

export function JoinGame() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const continueToLobby = async (event: React.FormEvent) => {
    event.preventDefault();
    const pin = normalizePin(code);
    if (pin.length !== 6) return setError('أدخل رمز اللعبة المكوّن من 6 أرقام.');

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/by-code/${encodeURIComponent(pin)}`, { signal: controller.signal });
      const room = await response.json().catch(() => null);
      if (response.status === 404) throw new Error('اللعبة غير موجودة. تحقق من الرمز وحاول مرة أخرى.');
      if (!response.ok || !room?.roomId) throw new Error(room?.detail || 'تعذر التحقق من رمز اللعبة.');
      window.location.assign(`/join/?${new URLSearchParams({ roomId: room.roomId, code: pin })}`);
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'تعذر العثور على اللعبة.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setChecking(false);
      }
    }
  };

  return <section className="game-surface mx-auto min-h-[72vh] max-w-7xl overflow-hidden rounded-[2.5rem] border border-brand-100 p-4 shadow-2xl shadow-brand-100/60 sm:p-6 lg:p-8">
    <AmbientBackground />
    <div className="relative z-10 grid items-stretch gap-5 lg:grid-cols-[1.08fr_.92fr]">
      <MarketingHero context="join" />
      <div className="flex items-center rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl sm:p-9">
      <form onSubmit={continueToLobby} className="w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 -rotate-3 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-3xl text-white shadow-lg shadow-brand-200">🎮</div>
          <p className="mt-5 text-xs font-black text-brand-600">انضم فوراً</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">ادخل ساحة اللعب</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">اكتب الرمز الذي شاركه المضيف، وسنتحقق منه مباشرة.</p>
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

        <div>
          <label htmlFor="game-pin" className="label">رمز اللعبة (PIN)</label>
          <input id="game-pin" value={code} onChange={(event) => setCode(normalizePin(event.target.value))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" className="field py-4 text-center text-3xl font-black tracking-[.32em] placeholder:tracking-[.18em] placeholder:text-slate-300" />
        </div>

        <button type="submit" disabled={checking || code.length !== 6} className="primary-btn w-full py-4 text-base">
          <ButtonContent busy={checking} busyText="جاري التحقق…">متابعة إلى شخصيتك</ButtonContent>
        </button>
        <p className="text-center text-xs text-slate-400">هل تريد إنشاء مسابقة؟ <a href="/login/" className="font-black text-brand-600 hover:underline">دخول المنشئين</a></p>
      </form>
      </div>
    </div>
  </section>;
}

