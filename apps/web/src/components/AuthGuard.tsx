'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { RouteSkeleton } from './RouteSkeleton';
import { isLanMode } from '../services/runtime-mode';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(
        isLanMode
          ? '/local/'
          : `/login/?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <RouteSkeleton />;
  }
  return <>{children}</>;
}
