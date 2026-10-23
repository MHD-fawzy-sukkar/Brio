export function Spinner({className='h-4 w-4'}:{className?:string}) {
  return <span aria-hidden="true" className={`${className} inline-block animate-spin rounded-full border-2 border-current border-l-transparent`}/>;
}

export function ButtonContent({busy,busyText,children}:{busy:boolean;busyText:string;children:React.ReactNode}) {
  return <span className="inline-flex items-center justify-center gap-2">{busy&&<Spinner/>}{busy?busyText:children}</span>;
}

export function PageSkeleton({ className = '' }: { className?: string } = {}) {
  return (
    <div className={`mx-auto max-w-5xl space-y-7 animate-pulse ${className}`} aria-label="جاري تحميل الصفحة" role="status">
      {/* Top Header Placeholder */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2.5">
          <div className="h-3.5 w-24 rounded-full bg-slate-200/70" />
          <div className="h-7 w-52 rounded-xl bg-slate-200" />
          <div className="h-3.5 w-64 rounded-full bg-slate-200/50" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-slate-200" />
      </div>

      {/* Main Content Layout Placeholder */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card space-y-6 p-6 sm:p-7">
          <div className="space-y-2">
            <div className="h-3.5 w-24 rounded-full bg-slate-200/70" />
            <div className="h-12 w-full rounded-xl bg-slate-100" />
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded-full bg-slate-200/70" />
            <div className="h-36 w-full rounded-2xl bg-slate-100" />
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-11 w-full rounded-xl bg-slate-100" />
            <div className="h-11 w-full rounded-xl bg-slate-100" />
          </div>
        </div>

        <div className="card h-fit space-y-4 p-6">
          <div className="h-4 w-28 rounded-full bg-slate-200/70" />
          <div className="aspect-[16/10] w-full rounded-xl bg-slate-100" />
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-full bg-slate-100" />
            <div className="h-3.5 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
