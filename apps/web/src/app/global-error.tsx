'use client';

import { LocaleBootstrap, useTranslations } from '../i18n/use-locale';
import { LanguageSwitch } from '../i18n/LanguageSwitch';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale, t } = useTranslations();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <LocaleBootstrap />
      <body
        style={{
          margin: 0,
          fontFamily: 'Cairo,Tahoma,Arial,sans-serif',
          background: '#f7f8fc',
          color: '#172033',
        }}
      >
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section
            style={{
              maxWidth: 520,
              textAlign: 'center',
              background: '#fff',
              border: '1px solid #e6e9f0',
              borderRadius: 24,
              padding: 40,
            }}
          >
            <div style={{ fontSize: 48 }}>🛟</div>
            <LanguageSwitch />
            <h1>{t('حدث خطأ غير متوقع')}</h1>
            <p style={{ color: '#68748a' }}>
              {t('يمكنك إعادة تشغيل الواجهة بأمان. إذا انتهت جلستك فسيتم تحويلك إلى تسجيل الدخول.')}
            </p>
            <button
              onClick={reset}
              style={{
                border: 0,
                borderRadius: 14,
                background: '#9f3043',
                color: '#fff',
                padding: '12px 20px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {t('إعادة المحاولة')}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
