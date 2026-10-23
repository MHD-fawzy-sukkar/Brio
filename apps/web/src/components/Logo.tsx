'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { resolveLogoHref } from '../services/home-routing';

export function Logo({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  return (
    <Link
      href={resolveLogoHref(isAuthenticated)}
      className={`inline-flex items-center gap-2 text-xl font-black text-slate-900 transition hover:opacity-90 ${className}`}
      aria-label="Brio"
    >
      <img src="/bolt-original.png" alt="" width={66} height={44} className="brio-logo" draggable={false} />
      <span className="text-2xl font-black tracking-tight text-slate-900">Brio</span>
    </Link>
  );
}
