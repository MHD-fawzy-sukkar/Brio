export function PlayerFinale({ rank, score }: { rank: number | null; score: number }) {
  const topThree = Boolean(rank && rank <= 3);
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-100 bg-gradient-to-br from-white via-brand-50 to-amber-50 p-6 text-center text-slate-900 shadow-xl shadow-brand-100/60 sm:p-12">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }, (_, i) => (
          <i
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i * 43) % 100}%`,
              animationDelay: `-${(i % 8) * 0.3}s`,
              background: ['#fbbf24', '#34d399', '#fb7185', '#bd4b5d'][i % 4],
            }}
          />
        ))}
      </div>
      <div className="relative z-10">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-amber-200 bg-white text-6xl shadow-lg shadow-amber-100">
          {topThree ? '🏆' : '✨'}
        </div>
        <p className="mt-6 text-sm font-black text-brand-600">اكتملت المسابقة</p>
        <h2 className="mt-2 text-3xl font-black text-brand-950 sm:text-4xl">
          {rank === 1
            ? 'أنت بطل الجولة!'
            : topThree
              ? 'مركز رائع، أحسنت!'
              : 'لعب جميل ومحاولة تستحق التصفيق!'}
        </h2>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3">
          <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold text-slate-500">ترتيبك النهائي</span>
            <b className="mt-1 block text-4xl text-brand-700">#{rank || '—'}</b>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold text-slate-500">مجموع نقاطك</span>
            <b className="mt-1 block text-3xl text-amber-600">{score.toLocaleString('ar')}</b>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-md text-sm font-bold leading-7 text-slate-600">
          شكراً لمشاركتك! كل إجابة صحيحة وسريعة ساهمت في مجموعك النهائي.
        </p>
        <a href="/" className="primary-btn mt-8 inline-block">
          العودة إلى الصفحة الرئيسية
        </a>
      </div>
    </section>
  );
}
