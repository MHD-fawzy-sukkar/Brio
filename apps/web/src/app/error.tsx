'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Brio route error', error); }, [error]);
  return <div className="card mx-auto max-w-xl p-10 text-center"><div className="text-5xl">🛟</div><h1 className="mt-4 text-2xl font-black text-slate-900">تعذر فتح هذه الصفحة</h1><p className="mt-2 text-sm leading-6 text-slate-500">حدث خطأ مؤقت. لم نفقد بياناتك، ويمكنك المحاولة مجدداً أو العودة للرئيسية.</p><div className="mt-6 flex justify-center gap-2"><button onClick={reset} className="primary-btn">إعادة المحاولة</button><a href="/" className="secondary-btn">الرئيسية</a></div></div>;
}
