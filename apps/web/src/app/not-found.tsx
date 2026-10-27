'use client';
import Link from 'next/link';

import { useTranslations } from '../i18n/use-locale';
export default function NotFound() {
  const { t } = useTranslations();
  return (
    <section className="card mx-auto max-w-xl space-y-5 p-8 text-center">
      <p className="text-5xl font-black text-brand-600">404</p>
      <h1 className="text-2xl font-black">{t('الصفحة غير موجودة.')}</h1>
      <Link href="/" className="primary-btn inline-flex">
        {t('الرئيسية')}
      </Link>
    </section>
  );
}
