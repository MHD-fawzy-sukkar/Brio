'use client';
import { Suspense } from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import { PageSkeleton } from '../../components/Loading';
import { QuizStudio } from '../../features/quiz-studio/QuizStudio';
export default function BuilderPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<PageSkeleton kind="studio" />}>
        <QuizStudio />
      </Suspense>
    </AuthGuard>
  );
}
