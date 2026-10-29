'use client';
import { t } from '../../i18n/locale';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthoringQuestion, QuestionType, QuizSummaryDto } from '@brio/contracts';
import { validateImage } from '../../services/media-upload';
import { backgroundUploads, type UploadTask } from '../../services/background-upload';
import { loadResource, peekResource, setResource } from '../../services/resource-cache';
import { requestJson, jsonBody } from '../../services/http-json';
import { multiplierAfterTypeChange } from '../../services/question-form';
import { StoredQuestion, fromStored, blankOptions } from './model';
export function useQuestionEditor() {
  const router = useRouter();

  const params = useSearchParams();

  const quizId = params.get('quizId');

  const questionId = params.get('questionId');

  const cachedQuestion = peekResource<{ questions: StoredQuestion[] }>(
    `/api/quizzes/${quizId}`,
  )?.questions.find((item) => item.id === questionId);

  const edited = useRef(false);

  const [loadRevision, setLoadRevision] = useState(0);

  const [loadingQuestion, setLoadingQuestion] = useState(Boolean(questionId && !cachedQuestion));

  const [question, setQuestion] = useState<AuthoringQuestion>(
    cachedQuestion
      ? fromStored(cachedQuestion)
      : {
          type: 'MultipleChoice',
          text: '',
          durationMs: 20000,
          multiplier: 'Standard',
          options: blankOptions(4),
          acceptedAlternatives: [],
          essentialImage: null,
        },
  );

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [storedImageUrl, setStoredImageUrl] = useState<string | null>(
    cachedQuestion?.media_url ?? cachedQuestion?.essentialImage ?? null,
  );

  const [activeUpload, setActiveUpload] = useState<UploadTask | undefined>();

  const uploadedImageUrl =
    activeUpload?.state === 'failed' ? null : activeUpload?.resultUrl || activeUpload?.previewUrl;

  const visibleImageUrl = imageRemoved ? null : imagePreview || uploadedImageUrl || storedImageUrl;

  useEffect(
    () => () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  useEffect(() => {
    if (!quizId || !questionId) return;
    let active = true;
    setLoadingQuestion(!cachedQuestion);
    setError(null);
    loadResource(`/api/quizzes/${quizId}`, () =>
      requestJson<{ questions: StoredQuestion[] }>(`/api/quizzes/${quizId}`),
    )
      .then((data) => {
        if (!active) return;
        const found = data.questions.find((item) => item.id === questionId);
        if (!found) throw new Error(t('السؤال غير موجود.'));
        if (!edited.current) setQuestion(fromStored(found));
        setStoredImageUrl(found.media_url ?? found.essentialImage ?? null);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoadingQuestion(false);
      });
    return () => {
      active = false;
    };
  }, [quizId, questionId, loadRevision]);

  useEffect(() => {
    if (!quizId || !questionId) return;
    const update = () => setActiveUpload(backgroundUploads.latestQuestion(quizId, questionId));
    update();
    return backgroundUploads.subscribe(update);
  }, [quizId, questionId]);

  const changeType = (type: QuestionType) => {
    edited.current = true;
    setQuestion((current) => ({
      ...current,
      type,
      multiplier: multiplierAfterTypeChange(current.type, type, current.multiplier),
      options:
        type === 'MultipleChoice'
          ? blankOptions(4)
          : type === 'TrueFalse'
            ? [
                { text: t('صح'), isCorrect: true },
                { text: t('خطأ'), isCorrect: false },
              ]
            : type === 'Poll'
              ? blankOptions(2).map((item) => ({ ...item, isCorrect: false }))
              : [],
      acceptedAlternatives: type === 'ShortAnswer' ? [''] : [],
    }));
  };

  const updateOption = (index: number, text: string) =>
    setQuestion((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, text } : option)),
    }));

  const markCorrect = (index: number) =>
    setQuestion((current) => ({
      ...current,
      options: current.options.map((option, i) => ({ ...option, isCorrect: i === index })),
    }));

  const addOption = () =>
    setQuestion((current) => ({ ...current, options: [...current.options, { text: '', isCorrect: false }] }));

  const removeOption = (index: number) =>
    setQuestion((current) => {
      if (current.options.length <= 2) return current;
      const options = current.options.filter((_, i) => i !== index);
      if (current.type === 'MultipleChoice' && !options.some((option) => option.isCorrect))
        options[0] = { ...options[0], isCorrect: true };
      return { ...current, options };
    });

  const chooseImage = (file?: File) => {
    if (!file) return;
    try {
      validateImage(file);
      edited.current = true;
      setImageRemoved(false);
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('الصورة غير صالحة.'));
    }
  };

  const removeImage = () => {
    edited.current = true;
    setImageRemoved(true);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || loadingQuestion) return;
    if (!quizId) return setError(t('معرّف المسابقة مفقود.'));
    setBusy(true);
    setError(null);
    const payload = {
      ...question,
      essentialImage: null,
      removeImage: imageRemoved,
      text: question.text.trim(),
      options: question.options.map((option) => ({ ...option, text: option.text.trim() })),
      acceptedAlternatives: question.acceptedAlternatives.map((item) => item.trim()).filter(Boolean),
    };
    const path = questionId
      ? `/api/quizzes/${quizId}/questions/${questionId}`
      : `/api/quizzes/${quizId}/questions`;
    try {
      if (imageRemoved && questionId) await backgroundUploads.waitForQuestion(quizId, questionId);
      const body = await requestJson<{ questionId?: string }>(
        path,
        jsonBody(questionId ? 'PUT' : 'POST', payload),
      );
      const savedQuestionId = questionId || body?.questionId;
      if (imageRemoved && savedQuestionId)
        for (const task of backgroundUploads.list(quizId))
          if (task.questionId === savedQuestionId) backgroundUploads.dismiss(task.id);
      const cached = peekResource<{ id: string; questions: StoredQuestion[] }>(`/api/quizzes/${quizId}`);
      if (cached && savedQuestionId) {
        const previous = cached.questions.find((item) => item.id === savedQuestionId);
        const nextQuestion = {
          ...previous,
          ...payload,
          id: savedQuestionId,
          duration_ms: payload.durationMs,
          options: payload.options.map((option) => ({ ...option, is_correct: option.isCorrect ? 1 : 0 })),
          media_url: imageRemoved ? null : (previous?.media_url ?? null),
        };
        const questions = previous
          ? cached.questions.map((item) => (item.id === savedQuestionId ? nextQuestion : item))
          : [...cached.questions, nextQuestion];
        setResource(`/api/quizzes/${quizId}`, { ...cached, questions });
        const summaries = peekResource<QuizSummaryDto[]>('/api/quizzes');
        if (summaries)
          setResource(
            '/api/quizzes',
            summaries.map((item) =>
              item.id === quizId
                ? { ...item, questionCount: questions.length, updatedAt: new Date().toISOString() }
                : item,
            ),
          );
      }
      if (imageFile && savedQuestionId) backgroundUploads.enqueueQuestion(quizId, savedQuestionId, imageFile);
      router.push(`/builder/?quizId=${quizId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذّر حفظ السؤال.'));
    } finally {
      setBusy(false);
    }
  };
  return {
    router,
    params,
    quizId,
    questionId,
    cachedQuestion,
    edited,
    loadRevision,
    setLoadRevision,
    loadingQuestion,
    setLoadingQuestion,
    question,
    setQuestion,
    busy,
    setBusy,
    error,
    setError,
    imageFile,
    setImageFile,
    imagePreview,
    setImagePreview,
    storedImageUrl,
    setStoredImageUrl,
    activeUpload: imageRemoved ? undefined : activeUpload,
    setActiveUpload,
    uploadedImageUrl,
    visibleImageUrl,
    changeType,
    updateOption,
    markCorrect,
    addOption,
    removeOption,
    chooseImage,
    removeImage,
    save,
  };
}
export type QuestionEditorController = ReturnType<typeof useQuestionEditor>;
