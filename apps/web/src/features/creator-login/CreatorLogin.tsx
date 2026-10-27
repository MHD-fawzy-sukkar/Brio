'use client';

import { useTranslations } from '../../i18n/use-locale';

import { AmbientBackground } from '../../components/AmbientBackground';
import { Spinner } from '../../components/Loading';
import { Logo } from '../../components/Logo';
import { MarketingHero } from '../../components/MarketingHero';

import { useCreatorLogin } from './use-creator-login';
export function CreatorLogin() {
  const { t, translateMessage } = useTranslations();
  const {
    buttonRef,
    rememberRef,
    remember,
    setRemember,
    submitting,
    setSubmitting,
    error,
    setError,
    handleFallbackClick,
  } = useCreatorLogin();
  return (
    <div className="game-surface mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-brand-100 p-3 shadow-xl shadow-brand-100/40 sm:p-5 lg:p-6">
      <AmbientBackground />
      <div className="relative z-10 grid items-stretch gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <MarketingHero context="login" />
        <section className="card order-first flex w-full flex-col items-center justify-center px-5 py-10 sm:px-9 sm:py-12 lg:order-none">
          <div className="w-full max-w-[360px]">
            <div className="mb-8 text-center">
              <Logo className="mx-auto" />
              <h1 className="mt-7 text-2xl font-black text-slate-900">{t('تسجيل الدخول')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t('تابع إلى مساحة مسابقاتك باستخدام حساب Google.')}
              </p>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"
              >
                {translateMessage(error ?? '')}
              </div>
            )}
            <div
              onClick={handleFallbackClick}
              className={`relative flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white transition hover:border-brand-300 hover:bg-brand-50/40 focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2 ${submitting ? 'opacity-75' : ''}`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none flex items-center gap-3 text-sm font-bold text-slate-700"
              >
                {submitting && <Spinner className="h-4 w-4 text-brand-600" />}
                <span>
                  {t('تسجيل الدخول باستخدام')} <bdi>Google</bdi>
                </span>
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24.4v7.42h10.77a9.21 9.21 0 0 1-4 6.05v5.03h6.47c3.78-3.48 5.97-8.6 5.97-14.58Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24.4 44c5.4 0 9.92-1.79 13.24-4.96l-6.47-5.03c-1.79 1.2-4.08 1.93-6.77 1.93-5.2 0-9.62-3.5-11.2-8.22H6.53v5.2A20 20 0 0 0 24.4 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M13.2 27.72a12 12 0 0 1 0-7.44v-5.2H6.53a20 20 0 0 0 0 17.84l6.67-5.2Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24.4 12.06c2.94 0 5.56 1.01 7.65 3l5.74-5.74A19.22 19.22 0 0 0 24.4 4 20 20 0 0 0 6.53 15.08l6.67 5.2c1.58-4.72 6-8.22 11.2-8.22Z"
                  />
                </svg>
              </div>
              {/* The real Google button receives pointer and keyboard input; only its visual label is replaced. */}
              <div
                dir="ltr"
                className="absolute inset-0 flex items-center justify-center opacity-0"
                ref={buttonRef}
                inert={submitting}
                aria-label={t('تسجيل الدخول باستخدام Google')}
              />
            </div>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl p-2 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => {
                  setRemember(event.target.checked);
                  rememberRef.current = event.target.checked;
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs font-black transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-2 ${remember ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}
              >
                ✓
              </span>
              <span className="text-start">
                <strong className="block text-sm font-bold text-slate-700">
                  {t('ابقَ مسجّلاً على هذا الجهاز')}
                </strong>
                <small className="mt-1 block text-xs leading-5 text-slate-500">
                  {t('لمدة 30 يوماً على جهازك الشخصي.')}
                </small>
              </span>
            </label>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-300">
              <span className="h-px flex-1 bg-slate-200" />
              <span>{t('دخول آمن')}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <p className="text-center text-xs leading-6 text-slate-400">
              {t(
                'لن يحصل Brio على كلمة مرور Google. بالمتابعة أنت توافق على استخدام جلسة آمنة لإدارة مسابقاتك.',
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
