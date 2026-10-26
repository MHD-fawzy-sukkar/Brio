'use client';
import { QuestionEditor } from '../../features/question-editor/QuestionEditor';
import { AuthGuard } from '../../components/AuthGuard';
import { Suspense } from 'react';
import { PageSkeleton } from '../../components/Loading';
export default function QuestionsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<PageSkeleton />}>
        <QuestionEditor />
      </Suspense>
    </AuthGuard>
  );
}
