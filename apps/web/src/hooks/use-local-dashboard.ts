'use client';
import { t } from '../i18n/locale';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { isLanMode } from '../services/runtime-mode';
import {
  localRequest,
  localRoomHref,
  type LocalInfo,
  type LocalQuiz,
  type LocalRoom,
} from '../services/local-dashboard';

type PendingAction =
  | { type: 'end'; quizId?: string }
  | { type: 'quiz'; quiz: LocalQuiz }
  | { type: 'session'; room: LocalRoom };

export function useLocalDashboard() {
  const { refresh } = useAuth();
  const [info, setInfo] = useState<LocalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quizDeleteError, setQuizDeleteError] = useState<{ quizId: string; message: string } | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const load = useCallback(async () => setInfo(await localRequest<LocalInfo>('/api/local/info')), []);
  const connect = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await localRequest('/api/local/login', { method: 'POST' });
      await refresh();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذّر فتح لوحة المقدّم.'));
    } finally {
      setLoading(false);
    }
  }, [load, refresh]);
  useEffect(() => {
    if (isLanMode) void connect();
  }, [connect]);
  const activeRoom = info?.rooms.find((room) => room.phase !== 'FINISHED');
  const pastRooms = info?.rooms.filter((room) => room.phase === 'FINISHED') || [];

  const perform = async (action: () => Promise<void>, onError?: (message: string) => void) => {
    setBusy(true);
    setError('');
    setQuizDeleteError(null);
    setMessage('');
    try {
      await action();
    } catch (cause) {
      setPending(null);
      const detail = cause instanceof Error ? cause.message : t('تعذّر إتمام العملية. يرجى المحاولة مجدداً.');
      if (onError) onError(detail);
      else setError(detail);
    } finally {
      setBusy(false);
    }
  };
  const openRoom = async (quizId: string) => {
    try {
      const room = await localRequest<LocalRoom>('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      });
      window.location.assign(localRoomHref(room));
    } catch (cause) {
      await load();
      throw cause;
    }
  };
  const start = (quizId: string) => {
    if (activeRoom) setPending({ type: 'end', quizId });
    else void perform(() => openRoom(quizId));
  };
  const importFile = (file?: File) => {
    if (!file) return;
    void perform(async () => {
      if (file.size > 48 * 1024 * 1024)
        throw new Error(t('حجم الملف يتجاوز 48 ميغابايت. يرجى تقليل أحجام الصور وإعادة تنزيل المسابقة.'));
      await localRequest('/api/local/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: file,
      });
      await load();
      setMessage(t('أُضيفت المسابقة وصورها بنجاح. اختر «فتح غرفة» لبدء جلسة جديدة.'));
    });
  };
  const confirm = () => {
    const deletingQuizId = pending?.type === 'quiz' ? pending.quiz.id : null;
    void perform(
      async () => {
        if (!pending) return;
        if (pending.type === 'end') {
          if (!activeRoom) {
            setPending(null);
            await load();
            return;
          }
          await localRequest(`/api/rooms/${activeRoom.roomId}`, { method: 'DELETE' });
          await load();
          setPending(null);
          if (pending.quizId) await openRoom(pending.quizId);
          else setMessage(t('انتهت الغرفة وحُفظت نتائج الجلسة.'));
        } else {
          const path =
            pending.type === 'quiz'
              ? `quizzes/${encodeURIComponent(pending.quiz.id)}`
              : `rooms/${pending.room.roomId}`;
          await localRequest(`/api/local/${path}`, { method: 'DELETE' });
          await load();
          setPending(null);
          setMessage(
            pending.type === 'quiz'
              ? t('حُذفت المسابقة من هذا الجهاز. نتائج الجلسات السابقة محفوظة.')
              : t('حُذفت نتائج الجلسة.'),
          );
        }
      },
      deletingQuizId
        ? (detail) => setQuizDeleteError({ quizId: deletingQuizId, message: detail })
        : undefined,
    );
  };
  const confirmation =
    pending?.type === 'quiz'
      ? {
          title: t('حذف المسابقة من هذا الجهاز؟'),
          description: t(
            'ستُحذف «{0}» من المسابقات الجاهزة. ستبقى نتائج جلساتها السابقة، ويمكنك إضافة ملف المسابقة مجدداً في أي وقت.',
            { 0: pending.quiz.title },
          ),
          confirmLabel: t('حذف المسابقة'),
          icon: '🗑️',
        }
      : pending?.type === 'session'
        ? {
            title: t('حذف نتائج الجلسة؟'),
            description: t(
              'ستُحذف نتائج «{0}» ذات الرمز {1} نهائياً من هذا الجهاز. لن تُحذف المسابقة نفسها.',
              { 0: pending.room.title, 1: pending.room.code },
            ),
            confirmLabel: t('حذف النتائج'),
            icon: '🗑️',
          }
        : {
            title: pending?.quizId ? t('إنهاء الغرفة وفتح غرفة جديدة؟') : t('إنهاء الغرفة الحالية؟'),
            description: t('ستنتهي جلسة «{0}» لجميع اللاعبين، وستُحفظ نتائجها.{1}', {
              0: activeRoom?.title || '',
              1: pending?.quizId ? t(' ستُفتح بعدها غرفة للمسابقة التي اخترتها.') : '',
            }),
            confirmLabel: pending?.quizId ? t('إنهاء وفتح غرفة جديدة') : t('إنهاء الغرفة'),
            icon: '🏁',
          };
  return {
    info,
    loading,
    busy,
    error,
    quizDeleteError,
    message,
    activeRoom,
    pastRooms,
    pending,
    confirmation,
    connect,
    start,
    importFile,
    confirm,
    cancel: () => setPending(null),
    endRoom: () => setPending({ type: 'end' }),
    deleteQuiz: (quiz: LocalQuiz) => {
      setError('');
      setMessage('');
      setQuizDeleteError(null);
      if (activeRoom?.quizId === quiz.id) {
        setQuizDeleteError({
          quizId: quiz.id,
          message: t(
            'لا يمكن حذف المسابقة لأنها مستخدمة في الغرفة الحالية ({0}). أنهِ الغرفة أولاً، ثم احذف المسابقة.',
            { 0: activeRoom.code },
          ),
        });
      } else setPending({ type: 'quiz', quiz });
    },
    deleteSession: (room: LocalRoom) => setPending({ type: 'session', room }),
  };
}
