'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { ConfirmDialog } from './ConfirmDialog';
import { JOIN_GAME_HREF } from '../services/home-routing';
import { isLanMode } from '../services/runtime-mode';

export function NavbarLinks() {
  const pathname = usePathname() || '';
  const isJoinActive = pathname.startsWith('/join');
  const isPlayerPage = isJoinActive || pathname.startsWith('/play');
  const isCreatorActive =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/questions') ||
    pathname.startsWith('/quizzes') ||
    pathname.startsWith('/local') ||
    pathname.startsWith('/identities');

  return (
    <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="التنقل الرئيسي">
      <Link
        href={JOIN_GAME_HREF}
        className={`relative whitespace-nowrap rounded-xl px-2 py-2 text-xs font-bold transition-colors sm:px-3.5 sm:text-sm ${
          isJoinActive
            ? 'text-brand-700 after:absolute after:inset-x-3.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-600'
            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
        }`}
      >
        انضم للعبة
      </Link>
      <Link
        href={isLanMode ? '/local/' : '/dashboard/'}
        className={`${isPlayerPage ? 'hidden sm:block' : ''} relative whitespace-nowrap rounded-xl px-2 py-2 text-xs font-bold transition-colors sm:px-3.5 sm:text-sm ${
          isCreatorActive
            ? 'text-brand-700 after:absolute after:inset-x-3.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-600'
            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
        }`}
      >
        {isLanMode ? 'لوحة المقدّم' : 'مسابقاتي'}
      </Link>
    </nav>
  );
}

export function AuthNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname() || '';

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmOpen(false);
    router.replace(isLanMode ? '/local/' : '/login/');
  };

  // Local sessions belong to this machine; there is no account to sign out of.
  if (isLanMode) return null;
  const playerPage = pathname.startsWith('/join') || pathname.startsWith('/play');
  return (
    <div className={playerPage ? 'hidden sm:block' : ''}>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-bold text-slate-600 sm:inline">
            مرحباً، {user.displayName}
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="secondary-btn cursor-pointer !px-3.5 !py-2 text-sm font-bold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700"
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
        <Link href={isLanMode ? '/local/' : '/login/'} className="primary-btn !px-4 !py-2 text-sm">
          دخول المنشئ
        </Link>
      )}
    </div>
  );
}
