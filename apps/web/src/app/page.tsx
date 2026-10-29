'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { PageSkeleton } from '../components/Loading';
import { JoinGame } from '../components/JoinGame';
import { resolveHomeExperience } from '../services/home-routing';
import { isLanMode } from '../services/runtime-mode';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const experience = resolveHomeExperience(loading, Boolean(user));

  useEffect(() => {
    if (experience === 'dashboard') router.replace(isLanMode ? '/local/' : '/dashboard/');
  }, [experience, router]);

  if (experience !== 'join') return <PageSkeleton kind="dashboard" />;
  return <JoinGame />;
}
