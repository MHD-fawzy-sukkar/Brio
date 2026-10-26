'use client';
import { useEffect } from 'react';

import { invalidateQuizResources } from '../../services/resource-cache';
import type { StudioState } from './use-studio-state';
import type { useStudioMedia } from './use-studio-media';

export function useStudioTitle(
  options: Pick<
    StudioState,
    | 'quizId'
    | 'quiz'
    | 'setQuiz'
    | 'title'
    | 'setTitle'
    | 'setIsEditingTitle'
    | 'setTitleSaved'
    | 'titleInputRef'
    | 'pendingTitleSaveRef'
    | 'savedBadgeTimeoutRef'
    | 'cover'
    | 'message'
    | 'setError'
  > & { activeCoverTask: ReturnType<typeof useStudioMedia>['activeCoverTask'] },
) {
  const {
    quizId,
    quiz,
    setQuiz,
    title,
    setTitle,
    setIsEditingTitle,
    setTitleSaved,
    titleInputRef,
    pendingTitleSaveRef,
    savedBadgeTimeoutRef,
    cover,
    message,
    setError,
    activeCoverTask,
  } = options;
  useEffect(
    () => () => {
      if (savedBadgeTimeoutRef.current) window.clearTimeout(savedBadgeTimeoutRef.current);
    },
    [savedBadgeTimeoutRef],
  );
  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setTitleSaved(false);
    window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  };

  const commitTitle = async () => {
    if (!quizId || !quiz) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(quiz.title);
      setIsEditingTitle(false);
      return;
    }
    if (trimmed === quiz.title) {
      setTitle(trimmed);
      setIsEditingTitle(false);
      return;
    }

    const previousTitle = quiz.title;
    setError(null);
    setQuiz((current) => (current ? { ...current, title: trimmed } : current));
    setTitle(trimmed);
    setIsEditingTitle(false);
    setTitleSaved(true);
    if (savedBadgeTimeoutRef.current) {
      window.clearTimeout(savedBadgeTimeoutRef.current);
    }
    savedBadgeTimeoutRef.current = window.setTimeout(() => setTitleSaved(false), 2000);

    const effectiveCoverUrl =
      (cover || activeCoverTask?.resultUrl || quiz.cover_image_url || quiz.coverImageUrl || '').trim() ||
      null;

    const savePromise = (async () => {
      try {
        const response = await fetch(`/api/quizzes/${quizId}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(30000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, coverImageUrl: effectiveCoverUrl }),
        });
        const body = await response.json().catch(() => null);
        if (response.ok) invalidateQuizResources(quizId);
        if (!response.ok) {
          throw new Error(body?.detail || 'تعذر حفظ عنوان المسابقة.');
        }
      } catch (cause) {
        setQuiz((current) => (current ? { ...current, title: previousTitle } : current));
        setTitle(previousTitle);
        setTitleSaved(false);
        setError(cause instanceof Error ? cause.message : 'تعذر حفظ عنوان المسابقة.');
      } finally {
        pendingTitleSaveRef.current = null;
      }
    })();

    pendingTitleSaveRef.current = savePromise;
    await savePromise;
  };
  return { startEditingTitle, commitTitle };
}
