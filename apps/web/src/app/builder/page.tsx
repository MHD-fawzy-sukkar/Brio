'use client';

import Link from 'next/link';
import { QuizIdentitySettings } from '../../features/competition-identity/QuizIdentitySettings';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AuthoringQuestion, QuestionType } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { useAuth } from '../../components/AuthProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { backgroundUploads, type UploadTask } from '../../services/background-upload';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { validateImage } from '../../services/media-upload';
import { PageSkeleton, Spinner } from '../../components/Loading';
import { loadResource, invalidateResources, invalidateQuizResources, peekResource, setResource } from '../../services/resource-cache';
import { requestJson, jsonBody } from '../../services/http-json';
import { questionOrderSync } from '../../services/question-order-sync';
import { useQuestionDrag } from '../../hooks/use-question-drag';
import { prefetchThemeLibrary } from '../../features/competition-identity/api';
import { downloadLanBundle } from '../../services/lan-export';

const questionTypeLabels: Record<QuestionType, string> = {
  MultipleChoice: 'اختيار من متعدد',
  TrueFalse: 'صح أو خطأ',
  ShortAnswer: 'إجابة قصيرة',
  Poll: 'استطلاع رأي'
};

interface QuizDetail {
  identity_id?: string | null;
  id: string;
  title: string;
  cover_image_url?: string | null;
  coverImageUrl?: string | null;
  revision: number;
  questions: Array<
    AuthoringQuestion & {
      id: string;
      duration_ms?: number;
      media_url?: string | null;
      options: Array<{ id?: string; text: string; is_correct?: number; isCorrect?: boolean }>;
    }
  >;
}

function Builder() {
  const { user } = useAuth();
  const params = useSearchParams();
  const quizId = params.get('quizId');
  const [quiz, setQuiz] = useState<QuizDetail | null>(() => quizId ? peekResource<QuizDetail>(`/api/quizzes/${quizId}`) ?? null : null);
  const loadVersion = useRef(0);
  const [title, setTitle] = useState(() => quizId ? peekResource<QuizDetail>(`/api/quizzes/${quizId}`)?.title ?? '' : '');
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
  const orderQueue = useMemo(() => quizId ? questionOrderSync(quizId) : null, [quizId, user?.id]);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderError, setOrderError] = useState('');
  useEffect(() => {
    if (!orderQueue) return;
    const update = () => {
      const state = orderQueue.snapshot();
      setReordering(state.saving); setOrderError(state.error);
      setOrderStatus(state.error ? 'الترتيب ظاهر عندك، لكن لم يُحفظ بعد.' : state.order ? state.saving ? 'جاري حفظ آخر ترتيب…' : 'تم حفظ ترتيب الأسئلة' : '');
    };
    update(); return orderQueue.subscribe(update);
  }, [orderQueue]);
  const saveOrder = (ids: string[]) => {
    if (!quiz || !quizId || !orderQueue || quiz.id !== quizId) return;
    const byId = new Map(quiz.questions.map(question => [question.id, question]));
    if (ids.length !== byId.size || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) return;
    loadVersion.current++;
    const next = { ...quiz, questions: ids.map(id => byId.get(id)!) };
    setQuiz(next); setResource(`/api/quizzes/${quizId}`, next, {transient:true});
    orderQueue.enqueue(ids);
  };
  const [starting, setStarting] = useState(false);
  const [downloadingLan, setDownloadingLan] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
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
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [deleteQuestionBusy, setDeleteQuestionBusy] = useState(false);

  const questionDrag = useQuestionDrag(quiz?.questions.map(question => question.id) ?? [], starting || downloadingLan || identitySaving, ids => { void saveOrder(ids); });

  const load = async () => {
    if (!quizId) throw new Error('معرّف المسابقة مفقود.');
    const requestVersion = ++loadVersion.current;
    let data = await loadResource<QuizDetail>(`/api/quizzes/${quizId}`, () => requestJson<QuizDetail>(`/api/quizzes/${quizId}`));
    if (requestVersion !== loadVersion.current) return;
    const queued = orderQueue?.snapshot();
    if (queued?.order && (queued.saving || queued.error)) {
      const byId = new Map(data.questions.map(question => [question.id, question]));
      if (queued.order.length === byId.size && queued.order.every(id => byId.has(id))) {
        data = {...data, questions:queued.order.map(id => byId.get(id)!)};
        setResource(`/api/quizzes/${quizId}`, data, {transient:true});
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
    const prefetchList = (data.questions || []).slice(0, 3)
      .map((q, idx) => ({
        url: q.media_url || q.essentialImage || '',
        questionId: q.id,
        isEssential: true,
        priority: idx <= 2 ? 1 : 2
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
    if (notice === 'cover-upload-failed') setWarning('تم إنشاء المسابقة بنجاح، لكن تعذر رفع الغلاف. يمكنك المحاولة مجدداً من هنا.');
    if (notice === 'question-image-failed') setWarning('تم حفظ السؤال بنجاح، لكن تعذر رفع صورته. يمكنك تعديل السؤال والمحاولة مجدداً.');
    setError(null);
    let active = true;
    void prefetchThemeLibrary();
    load().catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; loadVersion.current++; };
  }, [quizId, user?.id]);

  useEffect(() => {
    const update = () => {
      if (!quizId) return;
      const tasks = backgroundUploads.list(quizId);
      setUploadTasks(tasks);
      const newlyCompleted = tasks.filter((task) => task.state === 'completed' && !handledUploads.current.has(task.id));
      if (newlyCompleted.length > 0) {
        for (const task of newlyCompleted) {
          handledUploads.current.add(task.id);
          if (task.target === 'cover' && task.resultUrl) {
            setCover(task.resultUrl);
            setQuiz((current) => (current ? { ...current, cover_image_url: task.resultUrl, coverImageUrl: task.resultUrl } : current));
          }
          if (task.target === 'question' && task.questionId && task.resultUrl) {
            setQuiz((current) =>
              current
                ? {
                    ...current,
                    questions: current.questions.map((q) =>
                      q.id === task.questionId ? { ...q, media_url: task.resultUrl } : q
                    )
                  }
                : current
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
    (activeCoverTask?.state !== 'failed' ? activeCoverTask?.resultUrl || activeCoverTask?.previewUrl : null) ||
    cover ||
    quiz?.cover_image_url ||
    quiz?.coverImageUrl ||
    '';
  const hasCover = Boolean(displayCover);
  const failedUploads = uploadTasks.filter((task) => task.state === 'failed');

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
      (cover || activeCoverTask?.resultUrl || quiz.cover_image_url || quiz.coverImageUrl || '').trim() || null;

    const savePromise = (async () => {
      try {
        const response = await fetch(`/api/quizzes/${quizId}`, {
          method: 'PATCH',
          credentials: 'same-origin', signal: AbortSignal.timeout(30000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, coverImageUrl: effectiveCoverUrl })
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
      setError(cause instanceof Error ? cause.message : 'الصورة غير صالحة.');
    }
  };

  const confirmRemoveQuestion = async () => {
    if (!quizId || !deletingQuestionId || deleteQuestionBusy) return;
    setDeleteQuestionBusy(true); setError(null);
    try {
      await orderQueue?.flush();
      await requestJson(`/api/quizzes/${quizId}/questions/${deletingQuestionId}`, { method: 'DELETE' });
      setDeletingQuestionId(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر حذف السؤال.'); setDeletingQuestionId(null); }
    finally { setDeleteQuestionBusy(false); }
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
        credentials: 'same-origin', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || quiz.title, coverImageUrl: null })
      });
      const body = await response.json().catch(() => null);
      if (response.ok) invalidateQuizResources(quizId);
      if (!response.ok) {
        throw new Error(body?.detail || 'تعذر إزالة الغلاف.');
      }
    } catch (cause) {
      if (previousCover) {
        setCover(previousCover);
        setQuiz((current) => (current ? { ...current, cover_image_url: previousCover, coverImageUrl: previousCover } : current));
      }
      setError(cause instanceof Error ? cause.message : 'تعذر إزالة الغلاف.');
    }
  };

  const startGame = async () => {
    if (!quizId || starting || downloadingLan || identitySaving || reordering) return;
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      await orderQueue?.flush();
      if (isEditingTitle && title.trim() && title.trim() !== quiz?.title) {
        await commitTitle();
      } else if (pendingTitleSaveRef.current) {
        await pendingTitleSaveRef.current;
      }
      await requestJson(`/api/quizzes/${quizId}/publish`, { method: 'POST' });
      const room = await requestJson<{ roomId: string; code: string }>('/api/rooms', jsonBody('POST', { quizId }));
      window.location.assign(
        `/host/?roomId=${encodeURIComponent(room.roomId)}&code=${encodeURIComponent(room.code)}&quizId=${encodeURIComponent(quizId)}`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر بدء اللعبة.');
      setStarting(false);
    }
  };

  const downloadForLan = async () => {
    if (!quizId || starting || downloadingLan || identitySaving || reordering) return;
    setDownloadNotice(''); setDownloadProgress('جاري تجهيز المسابقة…');
    setDownloadingLan(true); setError(null); setMessage(null);
    try {
      await orderQueue?.flush();
      if (backgroundUploads.list(quizId).some(task => task.state === 'uploading')) throw new Error('انتظر انتهاء رفع الصور قبل تنزيل نسخة للّعب المحلي.');
      if (isEditingTitle && title.trim() && title.trim() !== quiz?.title) await commitTitle();
      else if (pendingTitleSaveRef.current) await pendingTitleSaveRef.current;
      await downloadLanBundle(quizId, setDownloadProgress);
      setDownloadNotice('تم تنزيل المسابقة وصورها. أضف الملف من لوحة المقدّم على اللابتوب.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تجهيز نسخة للّعب المحلي.'); }
    finally { setDownloadingLan(false); setDownloadProgress(''); }
  };

  if (!quiz && !error) return <PageSkeleton kind="studio" />;

  const deletingQuestion = quiz?.questions.find((q) => q.id === deletingQuestionId);

  return (
    <div data-mascot-flight-root className="relative space-y-7">
      <RoamingBolt scope="studio" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900">استوديو المسابقة</h1>
          <p className="mt-1 text-sm text-slate-500">عدّل معلومات المسابقة وهويتها، وأضف الأسئلة من هنا.</p>
        </div>
        <div className="studio-actions">
          <Link
            href="/dashboard/"
            className="secondary-btn inline-flex items-center justify-center gap-2 border-brand-200/90 bg-white px-5 py-3 text-sm font-black text-brand-700 shadow-2xs transition hover:border-brand-300 hover:bg-brand-50/70"
          >
            <span>→</span>
            <span>مسابقاتي</span>
          </Link>
          <div className="studio-download">
            <button onClick={downloadForLan} disabled={starting || downloadingLan || identitySaving || reordering || !quiz?.questions.length} className="secondary-btn w-full px-5 py-3" aria-busy={downloadingLan}>{downloadingLan ? 'جاري التنزيل…' : '↓ تنزيل للّعب المحلي'}</button>
            <div role="status" aria-live="polite" className="studio-download__status text-xs leading-5 text-slate-600">{downloadingLan ? downloadProgress : downloadNotice}</div>
          </div>
          <button onClick={startGame} disabled={starting || downloadingLan || identitySaving || reordering || !quiz?.questions.length} className="primary-btn px-7 py-3">
            {starting ? 'جاري تجهيز الغرفة…' : '▶ ابدأ اللعبة'}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}{!quiz && <button type="button" className="ms-3 underline" onClick={() => { setError(null); void load().catch(cause => setError(cause.message)); }}>إعادة المحاولة</button>}</div>}
      {warning && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          {warning}
          <button onClick={() => setWarning(null)} className="float-left text-amber-600" aria-label="إغلاق التنبيه">×</button>
        </div>
      )}
      {quiz && quizId && <QuizIdentitySettings key={quizId} quizId={quizId} quizTitle={quiz.title} disabled={starting || downloadingLan || reordering} value={quiz.identity_id ?? null} onBusyChange={setIdentitySaving} onSaved={id => { invalidateResources([`/api/quizzes/${quizId}`]); setQuiz(current => current?.id === quizId ? { ...current, identity_id: id } : current); }} />}
      {failedUploads.map((task) => (
        <div key={task.id} role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          <span>{task.error || 'تعذر رفع الصورة في الخلفية.'}</span>
          <button onClick={() => backgroundUploads.dismiss(task.id)} aria-label="إغلاق">×</button>
        </div>
      ))}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}
      {quiz && (
        <>
          <section data-mascot-flight-boundary className="card grid gap-6 p-6 sm:p-7 lg:grid-cols-[290px_1fr] lg:items-stretch">
            <div className="quiz-cover-frame group aspect-[16/10] rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-brand-50 via-white to-amber-50 transition hover:border-brand-400">
              {hasCover && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void removeCover();
                  }}
                  aria-label="حذف صورة الغلاف"
                  title="حذف صورة الغلاف"
                  className=" absolute top-2.5 right-2.5 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-slate-200/90 bg-white/95 text-slate-600 shadow-md backdrop-blur-xs transition-all duration-200 hover:scale-110 hover:border-rose-600 hover:bg-rose-600 hover:text-white active:scale-95"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              )}
              <label className="grid h-full w-full cursor-pointer place-items-center">
                {displayCover ? (
                  <img src={displayCover} alt="غلاف المسابقة" className="h-full w-full bg-slate-50/90 object-contain p-2" />
                ) : (
                  <div className="p-4 text-center text-sm font-bold text-slate-400">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-xs">🖼️</span>
                    <b className="mt-2.5 block text-slate-600">غلاف المسابقة</b>
                    <small className="mt-1 block text-xs text-slate-400">اضغط لإضافة صورة</small>
                  </div>
                )}
                <span className="absolute bottom-2.5 left-2.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-black text-brand-700 shadow-sm transition group-hover:bg-brand-600 group-hover:text-white">
                  {hasCover ? 'تغيير الغلاف' : 'رفع غلاف'}
                </span>
                {coverUploading && (
                  <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-600/95 px-3 py-1 text-[11px] font-black text-white shadow-sm">
                    <Spinner className="h-3 w-3" />
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    uploadCover(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-50/80 via-white to-brand-50/30 p-4 sm:p-5 ring-1 ring-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700 ring-1 ring-brand-200/60">
                  <span>🎯</span>
                  <span>عنوان المسابقة</span>
                </span>
                {titleSaved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200/70">
                    ✓ تم حفظ العنوان
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400">اضغط على العنوان أو أيقونة القلم للتعديل</span>
                )}
              </div>

              <div
                className={`relative flex items-center rounded-2xl border-2 bg-white shadow-2xs transition ${
                  isEditingTitle
                    ? 'border-brand-500 ring-4 ring-brand-500/12'
                    : 'border-slate-200/90 hover:border-brand-300'
                }`}
              >
                <input
                  id="quiz-title-input"
                  ref={titleInputRef}
                  readOnly={!isEditingTitle}
                  value={title}
                  maxLength={120}
                  onClick={() => {
                    if (!isEditingTitle) startEditingTitle();
                  }}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    if (isEditingTitle) void commitTitle();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitTitle();
                    } else if (e.key === 'Escape') {
                      setTitle(quiz.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className={`w-full bg-transparent px-5 py-4 pl-20 text-2xl font-black text-slate-900 outline-none sm:text-3xl ${
                    isEditingTitle ? 'cursor-text' : 'cursor-pointer'
                  }`}
                  placeholder="اكتب عنوان المسابقة…"
                />
                {isEditingTitle ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void commitTitle()}
                    aria-label="حفظ عنوان المسابقة"
                    title="حفظ العنوان"
                    className="absolute left-3 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-brand-700"
                  >
                    ✓ حفظ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startEditingTitle}
                    aria-label="تعديل عنوان المسابقة"
                    title="تعديل العنوان"
                    className="absolute left-3 grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-slate-200/90 bg-slate-50 text-base text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    ✏️
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
                  <span>📋</span>
                  <span>{quiz.questions.length ? `${quiz.questions.length} أسئلة في المسابقة` : 'لا توجد أسئلة بعد'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
                  <span>⏱️</span>
                  <span>
                    {Math.round(
                      quiz.questions.reduce((sum, q) => sum + (q.duration_ms || q.durationMs || 20000), 0) / 1000
                    )}{' '}
                    ثانية إجمالاً
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">الأسئلة</h2>
                <p className="text-sm text-slate-500">
                  {quiz.questions.length ? `${quiz.questions.length} سؤال في هذه المسابقة` : 'لا توجد أسئلة بعد'}
                </p>
              </div>
              <Link href={`/questions/?quizId=${quizId}`} aria-disabled={reordering} onClick={event => { if (reordering) event.preventDefault(); }} className="primary-btn">＋ سؤال جديد</Link>
            </div>
            {quiz.questions.length > 1 && <p id="question-order-help" className="mb-3 text-xs leading-6 text-slate-500">اسحب من ⋮⋮ لترتيب الأسئلة، أو استخدم السهم لأعلى أو لأسفل بعد تحديد المقبض. يُحفظ الترتيب فوراً.</p>}
            <div className="mb-3 min-h-5 text-xs text-brand-700"><span role="status" aria-live="polite">{orderStatus}</span>{orderError && <span role="alert" className="ms-2 text-rose-700">{orderError}<button type="button" className="ms-2 font-bold underline" onClick={() => { void orderQueue?.flush().catch(() => {}); }}>إعادة الحفظ</button></span>}</div>
            {quiz.questions.length === 0 ? (
              <div className="card p-14 text-center">
                <div className="text-4xl">✍️</div>
                <h3 className="mt-3 font-black">أضف أول سؤال</h3>
                <p className="mt-1 text-sm text-slate-500">ستظهر حقول الإجابات المناسبة بمجرد اختيار نوع السؤال.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quiz.questions.map((question, index) => {
                  const questionTask = uploadTasks
                    .filter((t) => t.target === 'question' && t.questionId === question.id)
                    .at(-1);
                  const questionImage =
                    (questionTask?.state !== 'failed' ? questionTask?.resultUrl || questionTask?.previewUrl : null) ||
                    question.media_url ||
                    question.essentialImage ||
                    null;

                  return (
                    <article key={question.id} data-question-id={question.id} className={`card question-order-card relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-3.5 ${questionDrag.draggedId === question.id ? 'question-drag-source' : ''} ${questionDrag.target?.target === question.id && questionDrag.draggedId !== question.id ? questionDrag.target.after ? 'question-drop-after' : 'question-drop-before' : ''}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {quiz.questions.length > 1 && <button type="button" disabled={starting || downloadingLan || identitySaving} aria-label={`اسحب لترتيب السؤال ${index + 1}: ${question.text}`} aria-describedby="question-order-help" className="question-drag-handle" {...questionDrag.handleProps(question.id)}>⋮⋮</button>}
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 font-black text-brand-700">
                          {index + 1}
                        </span>
                        {questionImage && (
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <img src={questionImage} loading="lazy" decoding="async" alt="صورة السؤال" className="h-full w-full object-contain p-1" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-black text-slate-900">{question.text}</h3>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                            <span>{questionTypeLabels[question.type] || question.type}</span>
                            <span>·</span>
                            <span>{(question.duration_ms || question.durationMs) / 1000} ثانية</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Link
                          href={`/questions/?quizId=${quizId}&questionId=${question.id}`}
                          aria-disabled={reordering} onClick={event => { if (reordering) event.preventDefault(); }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-2 text-sm font-black text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
                        >
                          تعديل
                        </Link>
                        <button
                          type="button"
                          disabled={reordering}
                          onClick={() => setDeletingQuestionId(question.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-white px-3.5 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                        >
                          حذف
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deletingQuestionId)}
        title="حذف السؤال؟"
        description={`سيتم حذف السؤال «${deletingQuestion?.text || ''}» نهائياً من هذه المسابقة.`}
        busy={deleteQuestionBusy}
        onCancel={() => setDeletingQuestionId(null)}
        onConfirm={confirmRemoveQuestion}
      />
    </div>
  );
}

export default function BuilderPage() {
  return <AuthGuard><Suspense fallback={<PageSkeleton kind="studio" />}><Builder /></Suspense></AuthGuard>;
}
