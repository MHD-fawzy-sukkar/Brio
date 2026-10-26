'use client';
import { Suspense } from 'react';
import { PageSkeleton } from '../../components/Loading';
import { PlayerGame } from '../../features/player-game/PlayerGame';
export default function PlayPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlayerGame />
    </Suspense>
  );
}
