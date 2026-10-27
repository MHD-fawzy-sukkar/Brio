'use client';
import { t } from '../../i18n/locale';

import { useEffect } from 'react';
import { setResource } from '../../services/resource-cache';
import { useQuestionDrag } from '../../hooks/use-question-drag';
import type { StudioState } from './use-studio-state';

export function useStudioOrder(
  options: Pick<
    StudioState,
    | 'quizId'
    | 'quiz'
    | 'setQuiz'
    | 'loadVersion'
    | 'error'
    | 'identitySaving'
    | 'setReordering'
    | 'orderQueue'
    | 'setOrderStatus'
    | 'setOrderError'
    | 'starting'
    | 'downloadingLan'
  >,
) {
  const {
    quizId,
    quiz,
    setQuiz,
    loadVersion,
    error,
    identitySaving,
    setReordering,
    orderQueue,
    setOrderStatus,
    setOrderError,
    starting,
    downloadingLan,
  } = options;
  useEffect(() => {
    if (!orderQueue) return;
    const update = () => {
      const state = orderQueue.snapshot();
      setReordering(state.saving);
      setOrderError(state.error);
      setOrderStatus(
        state.error
          ? t('الترتيب ظاهر عندك، لكن لم يُحفظ بعد.')
          : state.order
            ? state.saving
              ? t('جاري حفظ آخر ترتيب…')
              : t('تم حفظ ترتيب الأسئلة')
            : '',
      );
    };
    update();
    return orderQueue.subscribe(update);
  }, [orderQueue]);

  const saveOrder = (ids: string[]) => {
    if (!quiz || !quizId || !orderQueue || quiz.id !== quizId) return;
    const byId = new Map(quiz.questions.map((question) => [question.id, question]));
    if (ids.length !== byId.size || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id)))
      return;
    loadVersion.current++;
    const next = { ...quiz, questions: ids.map((id) => byId.get(id)!) };
    setQuiz(next);
    setResource(`/api/quizzes/${quizId}`, next, { transient: true });
    orderQueue.enqueue(ids);
  };

  const questionDrag = useQuestionDrag(
    quiz?.questions.map((question) => question.id) ?? [],
    starting || downloadingLan || identitySaving,
    (ids) => {
      void saveOrder(ids);
    },
  );
  return { saveOrder, questionDrag };
}
