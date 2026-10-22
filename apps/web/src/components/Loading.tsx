export function Spinner({className='h-4 w-4'}:{className?:string}) { return <span aria-hidden="true" className={`${className} inline-block animate-spin rounded-full border-2 border-current border-l-transparent`}/>; }
export function ButtonContent({busy,busyText,children}:{busy:boolean;busyText:string;children:React.ReactNode}) { return <span className="inline-flex items-center justify-center gap-2">{busy&&<Spinner/>}{busy?busyText:children}</span>; }
export function PageSkeleton({ label = 'جاري تحميل الصفحة…' }: { label?: string } = {}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg items-center justify-center px-4 py-12" aria-label={label} role="status">
      <div className="game-surface relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-brand-100 bg-white/90 p-8 text-center shadow-xl shadow-brand-100/40 backdrop-blur-sm sm:p-12">
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-400/20" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-2xl text-white shadow-lg shadow-brand-200">
            <Spinner className="h-6 w-6 text-white" />
          </div>
        </div>
        <p className="text-lg font-black text-slate-800">{label}</p>
        <p className="mt-1.5 text-xs font-bold text-slate-400">لحظات ونجهّز لك كل شيء…</p>
        <div className="mt-6 h-1.5 w-32 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full w-full origin-right animate-pulse rounded-full bg-gradient-to-l from-brand-500 to-amber-400" />
        </div>
      </div>
    </div>
  );
}
