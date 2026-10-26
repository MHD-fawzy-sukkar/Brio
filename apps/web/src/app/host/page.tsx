'use client';
import { Suspense } from 'react';
import { PageSkeleton } from '../../components/Loading';
import { AuthGuard } from '../../components/AuthGuard';
import { HostGame } from '../../features/host-game/HostGame';
export default function HostPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<PageSkeleton />}>
        <HostGame />
      </Suspense>
    </AuthGuard>
  );
}
