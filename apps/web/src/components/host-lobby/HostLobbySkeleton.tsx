'use client';
import { useTranslations } from '../../i18n/use-locale';
function Block({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`skeleton-shimmer max-w-full rounded-xl bg-slate-100 ${className}`} />
  );
}
/** Mirrors the actual controls, join card and player roster on desktop and phones. */
export function HostLobbySkeleton() {
  const { t } = useTranslations();
  return (
    <div
      role="status"
      aria-label={t('جاري تجهيز الغرفة…')}
      aria-busy="true"
      className="mx-auto max-w-6xl space-y-5"
    >
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Block className="h-12 w-12" />
          <div className="space-y-2">
            <Block className="h-3 w-36" />
            <Block className="h-6 w-48 max-w-full" />
            <Block className="h-3 w-24" />
          </div>
        </div>
        <div className="flex gap-3">
          <Block className="h-12 w-36" />
          <Block className="h-12 w-24" />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
        <div className="card flex flex-col items-center gap-5 p-7">
          <Block className="h-5 w-28" />
          <Block className="h-7 w-40" />
          <Block className="h-48 w-48" />
          <Block className="h-4 w-52 max-w-full" />
          <Block className="h-14 w-60 max-w-full" />
        </div>
        <div className="card space-y-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <Block className="h-7 w-40" />
            <Block className="h-7 w-24" />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((id) => (
              <div key={id} className="flex min-w-0 flex-col items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <Block className="h-16 w-16" />
                <Block className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
