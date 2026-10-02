'use client';

import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) window.location.replace(`/login/?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user]);

  if (loading || !user) {
    return <div className="card mx-auto max-w-md p-10 text-center"><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600"/><p className="text-sm font-bold text-slate-500">{loading ? 'جاري التحقق من الجلسة…' : 'جاري تحويلك إلى تسجيل الدخول…'}</p></div>;
  }
  return <>{children}</>;
}
