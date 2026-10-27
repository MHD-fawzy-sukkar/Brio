'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { pageTitles, siteDescription } from '../services/document-metadata';
import {
  getLocale,
  initializeLocale,
  serverLocale,
  setLocale,
  subscribeLocale,
  t,
  countNoun,
  translateMessage,
} from './locale';
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, serverLocale);
}
export function LocaleBootstrap() {
  const locale = useLocale();
  const pathname = usePathname();
  const titles = pageTitles[pathname?.replace(/\/$/, '') || '/'] || pageTitles['/'];
  useEffect(initializeLocale, []);
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === 'brio_language_v1' && (event.newValue === 'ar' || event.newValue === 'en'))
        setLocale(event.newValue);
    };
    window.addEventListener('storage', storage);
    return () => window.removeEventListener('storage', storage);
  }, []);
  return (
    <>
      <title>{`Brio — ${titles[locale === 'ar' ? 0 : 1]}`}</title>
      <meta name="description" content={siteDescription[locale]} />
    </>
  );
}

/** Bind rendered copy to React's hydration snapshot, not mutable browser state. */
export function useTranslations() {
  const locale = useLocale();
  return {
    locale,
    t: (source: string, values?: Record<string, string | number>) => t(source, values, locale),
    translateMessage: (source: string) => translateMessage(source, locale),
    numberLocale: () => locale,
    countNoun: (source: string, count: number) => countNoun(source, count, locale),
  };
}
