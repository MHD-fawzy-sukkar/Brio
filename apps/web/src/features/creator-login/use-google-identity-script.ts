'use client';
import { useEffect, useRef, useState } from 'react';
import { getLocale, initializeLocale, type Locale } from '../../i18n/locale';

// GIS carries its own language resources. Serialize loads so a previous language
// cannot finish later and replace the current SDK after a rapid switch.
let queue: Promise<void> = Promise.resolve();
export function useGoogleIdentityScript(locale: Locale) {
  const initialized = useRef(false);
  const [state, setState] = useState<{ locale: Locale; ready: boolean; error: boolean; version: number }>();
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initializeLocale();
    }
    if (locale !== getLocale()) return;
    let active = true;
    queue = queue
      .catch(() => {})
      .then(
        () =>
          new Promise<void>((resolve) => {
            if (!active) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = `https://accounts.google.com/gsi/client?hl=${locale}`;
            script.async = true;
            let finished = false;
            const finish = (ready: boolean) => {
              if (finished) return;
              finished = true;
              clearTimeout(timeout);
              script.remove();
              if (active)
                setState((previous) => ({
                  locale,
                  ready,
                  error: !ready,
                  version: (previous?.version ?? 0) + 1,
                }));
              resolve();
            };
            const timeout = setTimeout(() => finish(false), 20000);
            script.onload = () => finish(true);
            script.onerror = () => finish(false);
            document.head.appendChild(script);
          }),
      );
    return () => {
      active = false;
    };
  }, [locale]);
  return {
    version: state?.version ?? 0,
    ready: state?.locale === locale && state.ready,
    failed: state?.locale === locale && state.error,
  };
}
