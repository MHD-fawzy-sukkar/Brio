import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brio — منصة المسابقات التفاعلية الحية',
  description: 'منصة مسابقات تفاعلية حية بدون رسوم أو اشتراكات',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-xl font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
              <span className="text-2xl">⚡</span>
              <span>بريو | Brio</span>
            </a>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <a href="/play/" className="text-slate-300 hover:text-white transition-colors">الانضمام للعبة</a>
              <a href="/login/" className="text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:border-indigo-500/60 transition-colors">تسجيل المنشئ</a>
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>

        <footer className="w-full border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
            <p>جميع الحقوق محفوظة منصة Brio © 2026</p>
            <p className="font-mono text-slate-600">نسخة النظام: v2.0-p1</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
