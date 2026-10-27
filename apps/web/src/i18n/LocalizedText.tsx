'use client';

import { useTranslations } from './use-locale';
export function LocalizedText({ source }: { source: string }) {
  const { t } = useTranslations();
  return t(source);
}
