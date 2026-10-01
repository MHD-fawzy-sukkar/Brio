'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: 'mock:google-sub-1:creator@brio.com:منشئ المسابقات'
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'فشلت عملية المصادقة' }));
        throw new Error(errData.detail || 'فشلت عملية المصادقة');
      }

      window.location.href = '/dashboard/';
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto">
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-center">
        <div className="space-y-2">
          <div className="text-4xl">🔐</div>
          <h1 className="text-2xl font-bold text-white">تسجيل دخول المنشئ</h1>
          <p className="text-sm text-slate-400">سجّل دخولك لحساب Google لإدارة وإنشاء المسابقات</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 text-right">
            ⚠️ <strong>خطأ:</strong> {errorMsg}
          </div>
        )}

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2 text-right">
          <p className="font-semibold text-slate-300">💡 التحقق من المصادقة:</p>
          <p>تتم عملية التحقق من التوكن عبر خدمة Google OAuth JWKS التشفيرية الرسمية مع حظر أي تجاوز صوري في بيئة الإنتاج.</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-md cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2.0 10.04.0 12s.46 3.8 1.27 5.42l4.01-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{loading ? 'جاري تسجيل الدخول...' : 'التسجيل بواسطة حساب Google'}</span>
        </button>

        <a href="/" className="block text-xs text-slate-500 hover:text-slate-400">
          ← العودة للصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}
