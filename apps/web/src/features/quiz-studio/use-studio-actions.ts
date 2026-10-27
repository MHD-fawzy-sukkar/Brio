'use client';
import { t } from '../../i18n/locale';

import { useRouter } from 'next/navigation';
import { backgroundIdentitySaves } from '../competition-identity/background-identity-saves';
import { useEffect } from 'react';
import { backgroundUploads } from '../../services/background-upload';
import { requestJson, jsonBody } from '../../services/http-json';
import { downloadLanBundle } from '../../services/lan-export';
import type { StudioState } from './use-studio-state';
import type { useStudioTitle } from './use-studio-title';
import type { useStudioResource } from './use-studio-resource';

export function useStudioActions(
  options: Pick<
    StudioState,
    | 'quizId'
    | 'quiz'
    | 'title'
    | 'isEditingTitle'
    | 'pendingTitleSaveRef'
    | 'message'
    | 'setMessage'
    | 'setError'
    | 'identitySaving'
    | 'reordering'
    | 'orderQueue'
    | 'starting'
    | 'setStarting'
    | 'downloadingLan'
    | 'setDownloadingLan'
    | 'setDownloadProgress'
    | 'downloadNotice'
    | 'setDownloadNotice'
    | 'deletingQuestionId'
    | 'setDeletingQuestionId'
    | 'deleteQuestionBusy'
    | 'setDeleteQuestionBusy'
  > & {
    load: ReturnType<typeof useStudioResource>['load'];
    commitTitle: ReturnType<typeof useStudioTitle>['commitTitle'];
  },
) {
  const {
    quizId,
    quiz,
    title,
    isEditingTitle,
    pendingTitleSaveRef,
    message,
    setMessage,
    setError,
    identitySaving,
    reordering,
    orderQueue,
    starting,
    setStarting,
    downloadingLan,
    setDownloadingLan,
    setDownloadProgress,
    downloadNotice,
    setDownloadNotice,
    deletingQuestionId,
    setDeletingQuestionId,
    deleteQuestionBusy,
    setDeleteQuestionBusy,
    load,
    commitTitle,
  } = options;
  const router = useRouter();
  useEffect(() => {
    router.prefetch('/host/');
  }, [router]);
  useEffect(() => {
    if (!downloadNotice) return;
    const timeout = window.setTimeout(() => setDownloadNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [downloadNotice]);

  useEffect(() => {
    const restore = () => setStarting(false);
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const confirmRemoveQuestion = async () => {
    if (!quizId || !deletingQuestionId || deleteQuestionBusy) return;
    setDeleteQuestionBusy(true);
    setError(null);
    try {
      await orderQueue?.flush();
      await requestJson(`/api/quizzes/${quizId}/questions/${deletingQuestionId}`, { method: 'DELETE' });
      setDeletingQuestionId(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذّر حذف السؤال.'));
      setDeletingQuestionId(null);
    } finally {
      setDeleteQuestionBusy(false);
    }
  };

  const startGame = async () => {
    if (!quizId || starting || downloadingLan || identitySaving) return;
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      await orderQueue?.flush();
      await backgroundIdentitySaves.wait(quizId);
      if (isEditingTitle && title.trim() && title.trim() !== quiz?.title) {
        await commitTitle();
      } else if (pendingTitleSaveRef.current) {
        await pendingTitleSaveRef.current;
      }
      await requestJson(`/api/quizzes/${quizId}/publish`, { method: 'POST' });
      const room = await requestJson<{ roomId: string; code: string }>(
        '/api/rooms',
        jsonBody('POST', { quizId }),
      );
      router.push(
        `/host/?roomId=${encodeURIComponent(room.roomId)}&code=${encodeURIComponent(room.code)}&quizId=${encodeURIComponent(quizId)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذر بدء اللعبة.'));
      setStarting(false);
    }
  };

  const downloadForLan = async () => {
    if (!quizId || starting || downloadingLan || identitySaving) return;
    setDownloadNotice('');
    setDownloadProgress(t('جاري تجهيز المسابقة…'));
    setDownloadingLan(true);
    setError(null);
    setMessage(null);
    try {
      await orderQueue?.flush();
      if (backgroundUploads.list(quizId).some((task) => task.state === 'uploading'))
        throw new Error(t('انتظر انتهاء رفع الصور قبل تنزيل نسخة للّعب المحلي.'));
      if (isEditingTitle && title.trim() && title.trim() !== quiz?.title) await commitTitle();
      else if (pendingTitleSaveRef.current) await pendingTitleSaveRef.current;
      await backgroundIdentitySaves.wait(quizId);
      await downloadLanBundle(quizId, setDownloadProgress);
      setDownloadNotice(t('تم تنزيل المسابقة وصورها. أضف الملف من لوحة المقدّم على اللابتوب.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذّر تجهيز نسخة للّعب المحلي.'));
    } finally {
      setDownloadingLan(false);
      setDownloadProgress('');
    }
  };

  const deletingQuestion = quiz?.questions.find((q) => q.id === deletingQuestionId);
  return { confirmRemoveQuestion, startGame, downloadForLan, deletingQuestion };
}
