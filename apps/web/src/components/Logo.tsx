'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { resolveLogoHref } from '../services/home-routing';
import { isLanMode } from '../services/runtime-mode';

export function Logo({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  return (
    <Link
      href={isLanMode && isAuthenticated ? '/local/' : resolveLogoHref(isAuthenticated)}
      className={`inline-flex shrink-0 items-center gap-1 text-xl font-black text-slate-900 transition hover:opacity-90 sm:gap-2 ${className}`}
      aria-label="Brio"
    >
      <img src="/bolt-original.png" alt="" width={66} height={44} className="brio-logo w-11 sm:w-[66px]" draggable={false} />
      <span className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Brio</span>
    </Link>
  );
}
