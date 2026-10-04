import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { AuthNav } from '../components/AuthNav';
import { AuthProvider } from '../components/AuthProvider';
import { AmbientBackground } from '../components/AmbientBackground';
import { Logo } from '../components/Logo';
import { JOIN_GAME_HREF } from '../services/home-routing';

export const metadata: Metadata = {
  title: 'Brio — مسابقات تفاعلية حية',
  description: 'أنشئ مسابقات ممتعة وشاركها مباشرة مع جمهورك.',
  icons: {
    icon: { url: '/bolt-original.png', type: 'image/png' },
    apple: '/bolt-original.png'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="app-shell min-h-screen flex flex-col antialiased">
        <AmbientBackground fixed />
        <AuthProvider>
        <header className="app-navbar sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <nav className="hidden items-center gap-2 md:flex" aria-label="التنقل الرئيسي">
              <Link href={JOIN_GAME_HREF} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">انضم للعبة</Link>
              <Link href="/dashboard/" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">مسابقاتي</Link>
            </nav>
            <AuthNav />
          </div>
        </header>
        <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-8">{children}</main>
        <footer className="relative z-10 border-t border-white/80 bg-white/80 py-5 text-center text-xs text-slate-500">Brio © 2026 — متعة أكثر، إعداد أقل.</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
