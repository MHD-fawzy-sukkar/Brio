'use client';
import { t } from '../../i18n/locale';

import { useEffect } from 'react';
import { backgroundUploads } from '../../services/background-upload';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { loadResource, peekResource, setResource } from '../../services/resource-cache';
import { requestJson } from '../../services/http-json';
import { prefetchThemeLibrary } from '../competition-identity/api';
import type { QuizDetail } from './model';
import type { StudioState } from './use-studio-state';

export function useStudioResource(
  options: Pick<
    StudioState,
    | 'user'
    | 'params'
    | 'quizId'
    | 'setQuiz'
    | 'loadVersion'
    | 'title'
    | 'setTitle'
    | 'setIsEditingTitle'
    | 'cover'
    | 'setCover'
    | 'message'
    | 'setWarning'
    | 'error'
    | 'setError'
    | 'orderQueue'
  >,
) {
  const {
    user,
    params,
    quizId,
    setQuiz,
    loadVersion,
    title,
    setTitle,
    setIsEditingTitle,
    cover,
    setCover,
    message,
    setWarning,
    error,
    setError,
    orderQueue,
  } = options;
  const load = async () => {
    if (!quizId) throw new Error(t('معرّف المسابقة مفقود.'));
    const requestVersion = ++loadVersion.current;
    let data = await loadResource<QuizDetail>(`/api/quizzes/${quizId}`, () =>
      requestJson<QuizDetail>(`/api/quizzes/${quizId}`),
    );
    if (requestVersion !== loadVersion.current) return;
    const queued = orderQueue?.snapshot();
    if (queued?.order && (queued.saving || queued.error)) {
      const byId = new Map(data.questions.map((question) => [question.id, question]));
      if (queued.order.length === byId.size && queued.order.every((id) => byId.has(id))) {
        data = { ...data, questions: queued.order.map((id) => byId.get(id)!) };
        setResource(`/api/quizzes/${quizId}`, data, { transient: true });
      }
    }
    const latestCoverTask = backgroundUploads
      .list(quizId)
      .filter((task) => task.target === 'cover' && task.state !== 'failed')
      .at(-1);
    const resolvedCover = data.cover_image_url || data.coverImageUrl || latestCoverTask?.resultUrl || '';
    setQuiz(data);
    setTitle((current) => (current ? current : data.title));
    setCover((current) => resolvedCover || current);
    const prefetchList = (data.questions || [])
      .slice(0, 3)
      .map((q, idx) => ({
        url: q.media_url || q.essentialImage || '',
        questionId: q.id,
        isEssential: true,
        priority: idx <= 2 ? 1 : 2,
      }))
      .filter((item) => Boolean(item.url));
    if (prefetchList.length > 0) {
      globalMediaPrefetchEngine.queueImages(prefetchList);
    }
  };

  useEffect(() => {
    const cached = quizId ? peekResource<QuizDetail>(`/api/quizzes/${quizId}`) : undefined;
    setQuiz(cached ?? null);
    setTitle(cached?.title ?? '');
    setIsEditingTitle(false);
    setCover('');
    const notice = params.get('notice');
    if (notice === 'cover-upload-failed')
      setWarning(t('تم إنشاء المسابقة بنجاح، لكن تعذر رفع الغلاف. يمكنك المحاولة مجدداً من هنا.'));
    if (notice === 'question-image-failed')
      setWarning(t('تم حفظ السؤال بنجاح، لكن تعذر رفع صورته. يمكنك تعديل السؤال والمحاولة مجدداً.'));
    setError(null);
    let active = true;
    void prefetchThemeLibrary();
    load().catch((cause) => {
      if (active) setError(cause.message);
    });
    return () => {
      active = false;
      loadVersion.current++;
    };
  }, [quizId, user?.id]);
  return { load };
}
