'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { MarketingHero } from '../../components/MarketingHero';

interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    ux_mode: 'popup';
    auto_select: boolean;
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

export default function LoginPage() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const rememberRef = useRef(false);
  const [remember, setRemember] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!scriptLoaded || initializedRef.current) return;
    const identity = window.google?.accounts?.id;
    if (!identity || !buttonRef.current) return;
    if (!clientId) {
      setError('معرّف Google غير مهيأ. أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID ثم أعد بناء التطبيق.');
      setLoading(false);
      return;
    }

    let active = true;
    try {
      initializedRef.current = true;
      identity.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        callback: async (response) => {
          if (!active) return;
          if (!response.credential) {
            setError('لم يصل رمز المصادقة من Google.');
            return;
          }
          setLoading(true);
          setError(null);
          try {
            const result = await fetch('/api/auth/google', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: response.credential, remember: rememberRef.current })
            });
            if (!result.ok) {
              const problem = await result.json().catch(() => null);
              throw new Error(problem?.detail || 'تعذر تسجيل الدخول.');
            }
            const returnTo = new URLSearchParams(window.location.search).get('returnTo');
            window.location.replace(returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard/');
          } catch (cause) {
            if (active) {
              setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول.');
              setLoading(false);
            }
          }
        }
      });

      // React never renders children into this node. Google owns its contents.
      buttonRef.current.replaceChildren();
      const buttonWidth = Math.min(360, Math.max(240, Math.floor(buttonRef.current.getBoundingClientRect().width)));
      identity.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: buttonWidth,
        locale: 'ar'
      });
      setLoading(false);
    } catch (cause) {
      initializedRef.current = false;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : 'تعذر تهيئة تسجيل الدخول بواسطة Google.');
    }

    return () => {
      active = false;
      // Do not remove children here: Google owns the iframe and React does not.
      initializedRef.current = false;
    };
  }, [scriptLoaded, clientId]);

  return (
    <div className="relative mx-auto min-h-[72vh] max-w-7xl overflow-hidden rounded-[2.5rem] border border-brand-100 bg-gradient-to-br from-white via-brand-50 to-amber-50 p-4 shadow-2xl shadow-brand-100/60 sm:p-6 lg:p-8">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptLoaded(true)} onError={() => { setError('تعذر تحميل خدمة Google. تحقق من اتصالك ثم أعد المحاولة.'); setLoading(false); }} />
      <div className="absolute right-1/4 top-12 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="absolute bottom-10 left-1/4 h-48 w-48 rounded-full bg-amber-100/70 blur-3xl" />
      <div className="relative z-10 grid items-stretch gap-5 lg:grid-cols-[1.08fr_.92fr]">
      <MarketingHero context="login" />
      <section className="card flex w-full flex-col justify-center p-7 sm:p-10">
        <div className="mb-8 text-center">
          <a href="/" className="mx-auto flex w-fit items-center gap-2 text-xl font-black text-slate-900"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-200">⚡</span><span>Brio</span></a>
          <h1 className="mt-7 text-2xl font-black text-slate-900">تسجيل الدخول</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">تابع إلى مساحة مسابقاتك باستخدام حساب Google.</p>
        </div>
        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
        <div dir="ltr" className="flex min-h-12 w-full justify-center overflow-hidden rounded-xl shadow-sm" ref={buttonRef} aria-label="المتابعة باستخدام Google" />
        {loading && <p className="mt-2 text-center text-sm text-slate-400">جاري تحميل تسجيل الدخول…</p>}
        <label className={`mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${remember ? 'border-brand-300 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-200'}`}>
          <input type="checkbox" checked={remember} onChange={(event) => { setRemember(event.target.checked); rememberRef.current = event.target.checked; }} className="peer sr-only" />
          <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 text-xs font-black transition ${remember ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
          <span className="text-right"><strong className="block text-sm font-black text-slate-800">ابقَ مسجّلاً على هذا الجهاز</strong><small className="mt-1 block text-xs font-semibold leading-5 text-slate-500">لن تحتاج إلى تسجيل الدخول مجدداً لمدة 30 يوماً. استخدمه فقط على جهازك الشخصي.</small></span>
        </label>
        <div className="my-6 flex items-center gap-3 text-xs text-slate-300"><span className="h-px flex-1 bg-slate-200" /><span>دخول آمن</span><span className="h-px flex-1 bg-slate-200" /></div>
        <p className="text-center text-xs leading-6 text-slate-400">لن يحصل Brio على كلمة مرور Google. بالمتابعة أنت توافق على استخدام جلسة آمنة لإدارة مسابقاتك.</p>
      </section>
      </div>
    </div>
  );
}
