import type { Metadata } from 'next';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { LocaleBootstrap } from '../i18n/use-locale';
import { LocalizedText } from '../i18n/LocalizedText';
import './globals.css';
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-700.css';
import { AuthNav, NavbarLinks } from '../components/AuthNav';
import { AuthProvider } from '../components/AuthProvider';
import { AmbientBackground } from '../components/AmbientBackground';
import { Logo } from '../components/Logo';
import { isLanMode } from '../services/runtime-mode';
import { siteDescription } from '../services/document-metadata';

export const metadata: Metadata = {
  applicationName: 'Brio',
  openGraph: {
    type: 'website',
    siteName: 'Brio',
    title: 'Brio — مسابقات تفاعلية حية',
    description: siteDescription.ar,
    locale: 'ar',
    alternateLocale: ['en'],
    images: [{ url: 'https://brio-worker.fawzy-sukkar2005.workers.dev/favicon.png', alt: 'Brio' }],
  },
  twitter: {
    card: 'summary',
    title: 'Brio — مسابقات تفاعلية حية',
    description: siteDescription.ar,
  },
  icons: {
    icon: { url: '/favicon.png', type: 'image/png' },
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {isLanMode && <meta name="brio-runtime-lan" content="1" />}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preload" as="image" href="/bolt-original.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/avatars/bolt-base-v2.png" fetchPriority="high" />
        {!isLanMode && (
          <>
            <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
            <link rel="preconnect" href="https://api.cloudinary.com" crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body className="app-shell min-h-screen flex flex-col antialiased">
        <AmbientBackground fixed />
        <LocaleBootstrap />
        <AuthProvider>
          <header className="app-navbar sticky top-0 z-50 border-b border-slate-200/75 bg-white/92 backdrop-blur-md">
            <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:min-h-18 sm:px-6">
              <Logo />
              <NavbarLinks />
              <div className="flex items-center gap-2">
                <LanguageSwitch />
                <AuthNav />
              </div>
            </div>
          </header>
          <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-8">
            {children}
          </main>
          <footer className="relative z-10 border-t border-white/80 bg-white/80 py-5 text-center text-xs text-slate-500">
            <LocalizedText source="Brio © 2026 — متعة أكثر، إعداد أقل." />
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
