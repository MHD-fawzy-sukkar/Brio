'use client';

import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { PageSkeleton } from './Loading';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) window.location.replace(`/login/?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user]);

  if (loading || !user) {
    return <PageSkeleton/>;
  }
  return <>{children}</>;
}
