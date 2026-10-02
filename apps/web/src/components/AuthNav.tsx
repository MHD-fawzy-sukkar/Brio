'use client';

import { useAuth } from './AuthProvider';

export function AuthNav() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-100" aria-label="جاري التحقق" />;
  return user ? (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-bold text-slate-600 sm:inline">مرحباً، {user.displayName}</span>
      <button onClick={async () => { await logout(); window.location.replace('/login/'); }} className="secondary-btn !px-3 !py-2 text-sm">تسجيل الخروج</button>
    </div>
  ) : <a href="/login/" className="primary-btn !px-4 !py-2 text-sm">دخول المنشئ</a>;
}
