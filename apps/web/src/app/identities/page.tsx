'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '../../components/Loading';

/** Older bookmarks return to quiz selection; identity editing now lives in the builder. */
export default function IdentitiesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/'); }, [router]);
  return <PageSkeleton />;
}
