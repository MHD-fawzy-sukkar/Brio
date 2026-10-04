import { JoinQrCode } from '../JoinQrCode';
import { AmbientBackground } from '../AmbientBackground';

export function JoinInfoCard({ code }: { code: string }) {
  return <section aria-labelledby="join-info-title" className="game-surface overflow-hidden rounded-[1.75rem] border border-brand-100 p-5 shadow-xl shadow-brand-100/50 sm:p-6">
    <AmbientBackground />
    <div className="relative z-10">
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-[11px] font-black text-brand-700">الدخول السريع</span>
        <h2 id="join-info-title" className="mt-3 text-xl font-black text-slate-950">انضم إلى المسابقة</h2>
      </div>
      <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl shadow-sm">📱</span>
    </div>

    <div className="mx-auto mt-5 flex flex-col items-center justify-center gap-4">
      <JoinQrCode pin={code} className="w-40 shrink-0" />
    </div>

    <div className="mt-5 text-center">
      <p className="text-xs font-bold text-slate-500">امسح الرمز، أو أدخل رقم اللعبة</p>
      <div dir="ltr" aria-label={`رمز اللعبة ${code}`} className="mt-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 font-mono text-3xl font-black tracking-[.24em] text-brand-800 shadow-sm sm:text-4xl">
        {code || '------'}
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-slate-500">سيُفتح نموذج الانضمام والرمز مُعبّأ تلقائياً.</p>
    </div>
    </div>
  </section>;
}
