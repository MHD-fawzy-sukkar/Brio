import type { Metadata } from 'next';
import './globals.css';
import { AuthNav } from '../components/AuthNav';
import { AuthProvider } from '../components/AuthProvider';

export const metadata: Metadata = {
  title: 'Brio — مسابقات تفاعلية حية',
  description: 'أنشئ مسابقات ممتعة وشاركها مباشرة مع جمهورك.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <AuthProvider>
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
            <a href="/" className="flex items-center gap-2.5 text-xl font-black text-slate-900">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-200">⚡</span>
              <span>Brio</span>
            </a>
            <nav className="hidden items-center gap-2 md:flex" aria-label="التنقل الرئيسي">
              <a href="/" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">انضم للعبة</a>
              <a href="/dashboard/" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">مسابقاتي</a>
            </nav>
            <AuthNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">Brio © 2026 — متعة أكثر، إعداد أقل.</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
