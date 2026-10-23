'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { ConfirmDialog } from './ConfirmDialog';

export function AuthNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmOpen(false);
    router.replace('/login/');
  };

  return user ? (
    <div className="flex items-center gap-2.5">
      <span className="hidden text-sm font-bold text-slate-600 sm:inline">مرحباً، {user.displayName}</span>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="secondary-btn cursor-pointer !px-3.5 !py-2 text-sm font-black transition hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-700"
      >
        تسجيل الخروج
      </button>
      <ConfirmDialog
        open={confirmOpen}
        icon="👋"
        title="تأكيد تسجيل الخروج"
        description="هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟ ستحتاج إلى تسجيل الدخول مجدداً لإدارة مسابقاتك."
        confirmLabel="نعم، تسجيل الخروج"
        busyLabel="جاري الخروج…"
        cancelLabel="البقاء في الحساب"
        busy={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </div>
  ) : (
    <Link href="/login/" className="primary-btn !px-4 !py-2 text-sm">
      دخول المنشئ
    </Link>
  );
}
