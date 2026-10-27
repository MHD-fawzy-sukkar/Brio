'use client';
import { t } from '../../i18n/locale';

import { useEffect } from 'react';
import { backgroundUploads } from '../../services/background-upload';
import { validateImage } from '../../services/media-upload';
import { invalidateQuizResources } from '../../services/resource-cache';
import type { StudioState } from './use-studio-state';

export function useStudioMedia(
  options: Pick<
    StudioState,
    | 'quizId'
    | 'quiz'
    | 'setQuiz'
    | 'title'
    | 'cover'
    | 'setCover'
    | 'message'
    | 'setMessage'
    | 'setError'
    | 'uploadTasks'
    | 'setUploadTasks'
    | 'handledUploads'
  >,
) {
  const {
    quizId,
    quiz,
    setQuiz,
    title,
    cover,
    setCover,
    message,
    setMessage,
    setError,
    uploadTasks,
    setUploadTasks,
    handledUploads,
  } = options;
  useEffect(() => {
    const update = () => {
      if (!quizId) return;
      const tasks = backgroundUploads.list(quizId);
      setUploadTasks(tasks);
      const newlyCompleted = tasks.filter(
        (task) => task.state === 'completed' && !handledUploads.current.has(task.id),
      );
      if (newlyCompleted.length > 0) {
        for (const task of newlyCompleted) {
          handledUploads.current.add(task.id);
          if (task.target === 'cover' && task.resultUrl) {
            setCover(task.resultUrl);
            setQuiz((current) =>
              current
                ? { ...current, cover_image_url: task.resultUrl, coverImageUrl: task.resultUrl }
                : current,
            );
          }
          if (task.target === 'question' && task.questionId && task.resultUrl) {
            setQuiz((current) =>
              current
                ? {
                    ...current,
                    questions: current.questions.map((q) =>
                      q.id === task.questionId ? { ...q, media_url: task.resultUrl } : q,
                    ),
                  }
                : current,
            );
          }
        }
      }
    };
    update();
    return backgroundUploads.subscribe(update);
  }, [quizId]);

  const activeCoverTask = uploadTasks.filter((t) => t.target === 'cover').at(-1);

  const coverUploading = activeCoverTask?.state === 'uploading';

  const displayCover =
    (activeCoverTask?.state !== 'failed'
      ? activeCoverTask?.resultUrl || activeCoverTask?.previewUrl
      : null) ||
    cover ||
    quiz?.cover_image_url ||
    quiz?.coverImageUrl ||
    '';

  const hasCover = Boolean(displayCover);

  const failedUploads = uploadTasks.filter((task) => task.state === 'failed');

  const uploadCover = (file?: File) => {
    if (!file || !quizId) return;
    try {
      validateImage(file);
      setError(null);
      setMessage(null);
      for (const task of uploadTasks.filter((t) => t.target === 'cover')) {
        backgroundUploads.dismiss(task.id);
      }
      backgroundUploads.enqueueCover(quizId, file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('الصورة غير صالحة.'));
    }
  };

  const removeCover = async () => {
    if (!quizId || !quiz) return;
    const previousCover = cover || quiz.cover_image_url || quiz.coverImageUrl || '';
    setError(null);
    setMessage(null);
    for (const task of uploadTasks.filter((t) => t.target === 'cover')) {
      backgroundUploads.dismiss(task.id);
    }
    setCover('');
    setQuiz((current) => (current ? { ...current, cover_image_url: null, coverImageUrl: null } : current));

    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || quiz.title, coverImageUrl: null }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok) invalidateQuizResources(quizId);
      if (!response.ok) {
        throw new Error(body?.detail || t('تعذر إزالة الغلاف.'));
      }
    } catch (cause) {
      if (previousCover) {
        setCover(previousCover);
        setQuiz((current) =>
          current ? { ...current, cover_image_url: previousCover, coverImageUrl: previousCover } : current,
        );
      }
      setError(cause instanceof Error ? cause.message : t('تعذر إزالة الغلاف.'));
    }
  };
  return { activeCoverTask, coverUploading, displayCover, hasCover, failedUploads, uploadCover, removeCover };
}
