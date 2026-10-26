'use client';
import { usePathname } from 'next/navigation';
import { PageSkeleton, type SkeletonKind } from './Loading';
export function RouteSkeleton() {
  const path = usePathname() ?? '';
  const kind: SkeletonKind = path.startsWith('/dashboard')
    ? 'dashboard'
    : path.startsWith('/identities')
      ? 'themes'
      : path.startsWith('/builder')
        ? 'studio'
        : path.startsWith('/quizzes/new')
          ? 'create'
          : path.startsWith('/join') || path.startsWith('/login')
            ? 'join'
            : path.startsWith('/host') || path.startsWith('/play')
              ? 'game'
              : 'question';
  return <PageSkeleton kind={kind} />;
}
