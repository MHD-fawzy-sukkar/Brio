'use client';
import { useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { type UploadTask } from '../../services/background-upload';
import { peekResource } from '../../services/resource-cache';
import { questionOrderSync } from '../../services/question-order-sync';
import type { QuizDetail } from './model';

export function useStudioState() {
  const { user } = useAuth();
  const params = useSearchParams();
  const quizId = params.get('quizId');
  const [quiz, setQuiz] = useState<QuizDetail | null>(() =>
    quizId ? (peekResource<QuizDetail>(`/api/quizzes/${quizId}`) ?? null) : null,
  );
  const loadVersion = useRef(0);
  const [title, setTitle] = useState(() =>
    quizId ? (peekResource<QuizDetail>(`/api/quizzes/${quizId}`)?.title ?? '') : '',
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingTitleSaveRef = useRef<Promise<void> | null>(null);
  const savedBadgeTimeoutRef = useRef<number | null>(null);
  const [cover, setCover] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const handledUploads = useRef(new Set<string>());
  const [identitySaving, setIdentitySaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const orderQueue = useMemo(() => (quizId ? questionOrderSync(quizId) : null), [quizId, user?.id]);
  const [orderError, setOrderError] = useState('');
  const [starting, setStarting] = useState(false);
  const [downloadingLan, setDownloadingLan] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [deleteQuestionBusy, setDeleteQuestionBusy] = useState(false);
  return {
    user,
    params,
    quizId,
    quiz,
    setQuiz,
    loadVersion,
    title,
    setTitle,
    isEditingTitle,
    setIsEditingTitle,
    titleSaved,
    setTitleSaved,
    titleInputRef,
    pendingTitleSaveRef,
    savedBadgeTimeoutRef,
    cover,
    setCover,
    message,
    setMessage,
    warning,
    setWarning,
    error,
    setError,
    uploadTasks,
    setUploadTasks,
    handledUploads,
    identitySaving,
    setIdentitySaving,
    reordering,
    setReordering,
    orderQueue,
    orderError,
    setOrderError,
    starting,
    setStarting,
    downloadingLan,
    setDownloadingLan,
    downloadProgress,
    setDownloadProgress,
    downloadNotice,
    setDownloadNotice,
    deletingQuestionId,
    setDeletingQuestionId,
    deleteQuestionBusy,
    setDeleteQuestionBusy,
  };
}
export type StudioState = ReturnType<typeof useStudioState>;
