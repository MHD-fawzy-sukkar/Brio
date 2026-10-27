'use client';
import { t } from '../../i18n/locale';

import { useGoogleIdentityScript } from './use-google-identity-script';
import { useLocale } from '../../i18n/use-locale';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

export function useCreatorLogin() {
  const locale = useLocale();
  const router = useRouter();

  const { acceptSession } = useAuth();

  const buttonRef = useRef<HTMLDivElement>(null);

  const initializedRef = useRef(false);

  const rememberRef = useRef(false);

  const pendingClickRef = useRef(false);

  const [remember, setRemember] = useState(false);

  const googleScript = useGoogleIdentityScript(locale);
  const scriptLoaded = googleScript.ready;

  const [buttonReady, setButtonReady] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    router.prefetch('/dashboard/');
  }, [router]);

  useEffect(() => {
    if (googleScript.failed) {
      setError(t('تعذر تحميل خدمة Google. تحقق من اتصالك ثم أعد المحاولة.'));
      setSubmitting(false);
    }
  }, [googleScript.failed]);

  useEffect(() => {
    if (!scriptLoaded) {
      buttonRef.current?.replaceChildren();
      setButtonReady(false);
      return;
    }
    if (initializedRef.current) return;
    const identity = window.google?.accounts?.id;
    if (!identity || !buttonRef.current) return;
    if (!clientId) {
      setError(t('معرّف Google غير مهيأ. أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID ثم أعد بناء التطبيق.'));
      setSubmitting(false);
      return;
    }

    let active = true;
    let resizeObserver: ResizeObserver | undefined;
    const element = buttonRef.current;
    let renderedWidth = 0;
    let hasInteractedWithGoogle = false;

    const handleCredentialResponse = async (response: { credential?: string }) => {
      if (!active) return;
      if (!response.credential) {
        setError(t('لم يصل رمز المصادقة من Google.'));
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const result = await fetch('/api/auth/google', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: response.credential, remember: rememberRef.current }),
        });
        const payload = await result.json().catch(() => null);
        if (!result.ok) {
          throw new Error(payload?.detail || t('تعذر تسجيل الدخول.'));
        }
        if (payload?.creator) {
          acceptSession(payload.creator);
        }
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        const destination =
          returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard/';
        router.replace(destination);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : t('تعذر تسجيل الدخول.'));
          setSubmitting(false);
        }
      }
    };

    const renderButton = (force = false) => {
      if (!active || !element) return;
      const measuredWidth = Math.floor(element.getBoundingClientRect().width);
      const width = Math.min(360, measuredWidth > 0 ? measuredWidth : 320);
      if (!force && width === renderedWidth) return;
      renderedWidth = width;

      // Clear Google cooldown / dismissal cookie state
      document.cookie = 'g_state=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

      try {
        identity.cancel?.();
      } catch {}

      try {
        identity.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          callback: handleCredentialResponse,
        });
      } catch {}

      element.replaceChildren();
      identity.renderButton(element, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
        width,
        locale,
      });
    };

    try {
      initializedRef.current = true;
      renderButton();
      setButtonReady(true);
      if (pendingClickRef.current) {
        pendingClickRef.current = false;
        setSubmitting(false);
        try {
          identity.prompt?.();
        } catch {}
      }
      resizeObserver = new ResizeObserver(() => renderButton(false));
      resizeObserver.observe(element);

      const onBlur = () => {
        hasInteractedWithGoogle = true;
      };

      const onWindowFocusOrReturn = () => {
        if (hasInteractedWithGoogle || document.cookie.includes('g_state')) {
          hasInteractedWithGoogle = false;
          renderButton(true);
        }
      };

      const onVisibilityChange = () => {
        if (
          document.visibilityState === 'visible' &&
          (hasInteractedWithGoogle || document.cookie.includes('g_state'))
        ) {
          hasInteractedWithGoogle = false;
          renderButton(true);
        }
      };

      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onWindowFocusOrReturn);
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        active = false;
        resizeObserver?.disconnect();
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onWindowFocusOrReturn);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        initializedRef.current = false;
      };
    } catch (cause) {
      initializedRef.current = false;
      setSubmitting(false);
      setError(cause instanceof Error ? cause.message : t('تعذر تهيئة تسجيل الدخول بواسطة Google.'));
    }
  }, [scriptLoaded, googleScript.version, clientId, acceptSession, router, locale]);

  const handleFallbackClick = () => {
    if (buttonReady || submitting) return;
    if (!clientId) {
      setError(t('معرّف Google غير مهيأ. أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID ثم أعد بناء التطبيق.'));
      return;
    }
    pendingClickRef.current = true;
    setSubmitting(true);
  };
  return {
    router,
    acceptSession,
    buttonRef,
    initializedRef,
    rememberRef,
    pendingClickRef,
    remember,
    setRemember,
    scriptLoaded,
    buttonReady,
    setButtonReady,
    submitting,
    setSubmitting,
    error,
    setError,
    clientId,
    handleFallbackClick,
  };
}
export type CreatorLoginController = ReturnType<typeof useCreatorLogin>;
