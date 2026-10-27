'use client';

import { useTranslations } from '../i18n/use-locale';
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-l-transparent`}
    />
  );
}

export function ButtonContent({
  busy,
  busyText,
  children,
}: {
  busy: boolean;
  busyText: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {busy && <Spinner />}
      {busy ? busyText : children}
    </span>
  );
}

function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded-xl bg-slate-100 ${className}`} />;
}
export function ThemeCardsSkeleton({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  const { t } = useTranslations();
  if (compact)
    return (
      <div
        role="status"
        aria-label={t('جاري تحميل الهويات')}
        className="theme-library-gallery grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <span className="sr-only">{t('جاري تحميل الهويات…')}</span>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <Bone className="h-24 w-full" />
            <Bone className="h-5 w-2/3" />
            <Bone className="h-4 w-3/4" />
            <Bone className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  return (
    <div
      role="status"
      aria-label={t('جاري تحميل الهويات')}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card min-w-0 space-y-3 p-4">
          <Bone className="h-28 w-full" />
          <Bone className="h-6 w-2/3" />
          <Bone className="h-4 w-1/3" />
          <div className="flex gap-2 pt-1">
            <Bone className="h-12 flex-1" />
            <Bone className="h-12 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
export function QuizCardsSkeleton() {
  const { t } = useTranslations();
  return (
    <div
      role="status"
      aria-label={t('جاري تحميل المسابقات')}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[0, 1, 2].map((index) => (
        <div key={index} className="card overflow-hidden">
          <Bone className="aspect-[16/9] w-full !rounded-none" />
          <div className="space-y-3 p-5">
            <Bone className="h-6 w-3/4" />
            <Bone className="h-4 w-1/2" />
            <Bone className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
export type SkeletonKind = 'dashboard' | 'studio' | 'create' | 'themes' | 'question' | 'join' | 'game';
export function PageSkeleton({
  className = '',
  kind = 'question',
}: { className?: string; kind?: SkeletonKind } = {}) {
  const { t } = useTranslations();
  return (
    <div
      role="status"
      aria-label={t('جاري تحميل الصفحة')}
      className={`w-full min-w-0 space-y-6 ${kind === 'question' ? 'mx-auto max-w-5xl' : kind === 'create' ? 'quiz-create' : ''} ${className}`}
    >
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4">
        <div className="w-full max-w-sm space-y-3">
          <Bone className="h-8 w-2/3" />
          <Bone className="h-4 w-full" />
        </div>
        <Bone className="h-12 w-36" />
      </div>
      {kind === 'dashboard' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card space-y-3 p-5">
                <Bone className="h-4 w-20" />
                <Bone className="h-9 w-16" />
              </div>
            ))}
          </div>
          <QuizCardsSkeleton />
        </>
      ) : kind === 'themes' ? (
        <>
          <Bone className="h-12 w-full" />
          <ThemeCardsSkeleton />
        </>
      ) : kind === 'studio' ? (
        <>
          <div className="card space-y-3 p-5">
            <Bone className="h-6 w-36" />
            <Bone className="h-12 w-52 max-w-full" />
          </div>
          <div className="card grid gap-6 p-6 lg:grid-cols-[290px_minmax(0,1fr)]">
            <Bone className="aspect-[16/10] w-full" />
            <div className="space-y-4">
              <Bone className="h-5 w-28" />
              <Bone className="h-12 w-full" />
              <Bone className="h-5 w-1/2" />
            </div>
          </div>
          <Bone className="h-8 w-36" />
          <Bone className="card h-24 w-full" />
        </>
      ) : kind === 'create' ? (
        <>
          <div className="quiz-create__columns">
            <div className="card space-y-5 p-5">
              <Bone className="h-6 w-36" />
              <Bone className="h-12 w-full" />
              <Bone className="aspect-[2/1] w-full" />
              <Bone className="h-24 w-full" />
            </div>
            <div className="card space-y-5 p-5">
              <Bone className="h-6 w-40" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Bone key={i} className="h-36 w-full" />
                ))}
              </div>
              <Bone className="h-28 w-full" />
            </div>
          </div>
          <Bone className="h-32 w-full" />
        </>
      ) : kind === 'join' || kind === 'game' ? (
        <div className="card mx-auto max-w-2xl space-y-6 p-6">
          <Bone className="mx-auto h-24 w-24" />
          <Bone className="mx-auto h-8 w-2/3" />
          <Bone className="h-16 w-full" />
          <Bone className="h-14 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="card space-y-6 p-6">
            <Bone className="h-12 w-full" />
            <Bone className="h-52 w-full" />
            <Bone className="h-28 w-full" />
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
          </div>
          <div className="card h-fit space-y-5 p-6">
            <Bone className="h-6 w-32" />
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
            <Bone className="h-24 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
