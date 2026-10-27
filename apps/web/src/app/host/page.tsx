'use client';
import { Suspense } from 'react';
import { HostLobbySkeleton } from '../../components/host-lobby/HostLobbySkeleton';
import { AuthGuard } from '../../components/AuthGuard';
import { HostGame } from '../../features/host-game/HostGame';
export default function HostPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<HostLobbySkeleton />}>
        <HostGame />
      </Suspense>
    </AuthGuard>
  );
}
