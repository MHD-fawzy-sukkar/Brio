'use client';

import Link from 'next/link';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { QuizSummaryDto, CreatorParticipationStats } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { ButtonContent, PageSkeleton } from '../../components/Loading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { backgroundUploads, type UploadTask } from '../../services/background-upload';

import { useResource } from '../../hooks/use-resource';
import { setResource } from '../../services/resource-cache';
import { requestJson, jsonBody } from '../../services/http-json';
import { prefetchThemeLibrary } from '../../features/competition-identity/api';

function DashboardContent() {
  const { data, loading, error: loadError, reload } = useResource<QuizSummaryDto[]>('/api/quizzes');
  const quizzes = data ?? [];
  const participation = useResource<CreatorParticipationStats>('/api/creator/stats');
  const participationRetries = useRef(0);
  useEffect(() => {
    if (!participation.data?.pending || participation.error || participationRetries.current >= 12) return;
    const retry = window.setTimeout(() => {
      participationRetries.current++;
      participation.reload();
    }, 2500);
    return () => window.clearTimeout(retry);
  }, [participation.data, participation.error, participation.reload]);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<QuizSummaryDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  useEffect(() => {
    void prefetchThemeLibrary();
  }, []);

  useEffect(() => {
    const update = () => setUploadTasks(backgroundUploads.list());
    update();
    return backgroundUploads.subscribe(update);
  }, []);

  useEffect(() => {
    const restore = () => setStartingId(null);
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const stats = useMemo(
    () => ({
      quizCount: quizzes.length,
      questionCount: quizzes.reduce((total, quiz) => total + quiz.questionCount, 0),
    }),
    [quizzes],
  );

  const startRoom = async (quizId: string) => {
    if (startingId) return;
    setError(null);
    setStartingId(quizId);
    try {
      await requestJson(`/api/quizzes/${quizId}/publish`, { method: 'POST' });
      const body = await requestJson<{ roomId: string; code: string }>(
        '/api/rooms',
        jsonBody('POST', { quizId }),
      );
      window.location.assign(
        `/host/?roomId=${encodeURIComponent(body.roomId)}&code=${encodeURIComponent(body.code)}&quizId=${encodeURIComponent(quizId)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر بدء المسابقة.');
      setStartingId(null);
    }
  };

  const deleteQuiz = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await requestJson(`/api/quizzes/${deleting.id}`, { method: 'DELETE' });
      setResource(
        '/api/quizzes',
        quizzes.filter((quiz) => quiz.id !== deleting.id),
      );
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حذف المسابقة.');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };
  if (loading && !data) return <PageSkeleton kind="dashboard" />;

  return (
    <div data-mascot-flight-root className="relative space-y-8">
      <RoamingBolt scope="page" />
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black text-brand-600">لوحة المنشئ</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">مرحباً بك في Brio</h1>
          <p className="mt-2 text-slate-500">تابع مسابقاتك الأخيرة أو ابدأ تجربة جديدة.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/identities/" className="secondary-btn text-center">
            هوياتي البصرية
          </Link>
          <Link href="/quizzes/new/" className="primary-btn text-center">
            ＋ إنشاء مسابقة
          </Link>
        </div>
      </header>
      {(error || loadError) && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          {error || loadError}
          {loadError && (
            <button className="ms-3 underline" onClick={reload}>
              إعادة المحاولة
            </button>
          )}
        </div>
      )}
      <section data-mascot-flight-boundary className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-400">المسابقات</p>
          <b className="mt-2 block text-3xl text-slate-900">{stats.quizCount}</b>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-400">إجمالي الأسئلة</p>
          <b className="mt-2 block text-3xl text-brand-700">{stats.questionCount}</b>
        </div>
        <div className="card p-5" aria-busy={participation.loading || participation.data?.pending}>
          <p className="text-xs font-bold text-slate-400">إجمالي المشاركات</p>
          {participation.error ? (
            <div role="alert" className="mt-3 text-xs leading-6 text-rose-700">
              تعذّر تحميل العدد.
              <button type="button" className="ms-2 font-bold underline" onClick={participation.reload}>
                إعادة المحاولة
              </button>
            </div>
          ) : !participation.data ? (
            <div
              role="status"
              aria-label="جاري تحميل إجمالي المشاركات"
              className="skeleton-shimmer mt-2 h-9 w-20 rounded-xl bg-slate-100"
            />
          ) : (
            <b className="mt-2 block text-3xl text-brand-700">
              {participation.data.totalParticipations.toLocaleString('ar')}
            </b>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {participation.data?.pending ? 'جار تحديث العدد…' : 'مشاركات اللاعبين في جولاتك على الموقع'}
          </p>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">مسابقاتي الأخيرة</h2>
            <p className="mt-1 text-sm text-slate-500">المسودات والمنشورات في مكان واحد.</p>
          </div>
          {quizzes.length > 0 && (
            <span className="text-xs font-bold text-slate-400">{quizzes.length} مسابقة</span>
          )}
        </div>
        {loading ? (
          <PageSkeleton />
        ) : quizzes.length === 0 ? (
          <div className="card py-20 text-center">
            <div className="text-5xl">✨</div>
            <h3 className="mt-4 text-xl font-black">لا توجد مسابقات بعد</h3>
            <p className="mt-2 text-sm text-slate-500">أنشئ مسابقتك الأولى، ثم أضف الأسئلة في الاستوديو.</p>
            <Link href="/quizzes/new/" className="primary-btn mt-6 inline-block">
              إنشاء أول مسابقة
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => {
              const coverTask = uploadTasks
                .filter((t) => t.quizId === quiz.id && t.target === 'cover' && t.state !== 'failed')
                .at(-1);
              const coverUrl = coverTask?.resultUrl || coverTask?.previewUrl || quiz.coverImageUrl;
              return (
                <article
                  key={quiz.id}
                  className="card overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="aspect-[16/9] bg-gradient-to-br from-brand-100 via-brand-50 to-amber-50">
                    {coverUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={coverUrl}
                        alt={`غلاف ${quiz.title}`}
                        className="h-full w-full object-contain bg-slate-50"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-5xl">⚡</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 font-black text-slate-900">{quiz.title}</h3>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">
                        {quiz.questionCount} سؤال
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      آخر تعديل {new Date(quiz.updatedAt).toLocaleDateString('ar')}
                    </p>
                    <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Link
                        href={`/builder/?quizId=${quiz.id}`}
                        className="secondary-btn text-center text-sm"
                      >
                        تعديل
                      </Link>
                      <button
                        onClick={() => startRoom(quiz.id)}
                        disabled={startingId !== null || quiz.questionCount === 0}
                        className="primary-btn text-sm"
                      >
                        <ButtonContent busy={startingId === quiz.id} busyText="تجهيز…">
                          ابدأ
                        </ButtonContent>
                      </button>
                      <button
                        onClick={() => setDeleting(quiz)}
                        aria-label={`حذف ${quiz.title}`}
                        className="rounded-xl border border-rose-100 px-3 text-rose-600 hover:bg-rose-50"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المسابقة؟"
        description={`سيتم حذف «${deleting?.title || ''}» من قائمة مسابقاتك. لا يمكن التراجع عن هذا الإجراء.`}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={deleteQuiz}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
