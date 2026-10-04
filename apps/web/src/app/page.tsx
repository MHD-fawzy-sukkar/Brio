'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { PageSkeleton } from '../components/Loading';
import { JoinGame } from '../components/JoinGame';
import { resolveHomeExperience } from '../services/home-routing';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const experience = resolveHomeExperience(loading, Boolean(user));

  useEffect(() => {
    if (experience === 'dashboard') router.replace('/dashboard/');
  }, [experience, router]);

  if (experience !== 'join') return <PageSkeleton />;
  return <JoinGame />;
}
