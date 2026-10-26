'use client';

import { localRoomHref, type LocalRoom } from '../../services/local-dashboard';

export function LocalGuide() {
  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-xs font-bold text-brand-600">ثلاث خطوات للبدء</p>
        <h2 className="mt-1 text-xl font-black">طريقة الاستخدام</h2>
      </div>
      <ol className="space-y-3 text-sm leading-7 text-slate-600">
        {[
          'وصّل جهاز المقدّم وهواتف اللاعبين بشبكة Wi-Fi واحدة.',
          'افتح غرفة للمسابقة، ثم اعرض رمز الانضمام على اللاعبين.',
          'يمسح اللاعب الرمز ويختار اسمه؛ تُحمّل الصور تلقائياً على هاتفه.',
        ].map((text, index) => (
          <li key={text} className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 font-black text-brand-700">
              {index + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-xl bg-emerald-50 p-3 text-sm leading-7 text-emerald-900">
        بعد إضافة المسابقة، تنتقل الأسئلة والصور والإجابات داخل الشبكة. لا يحتاج اللعب إلى اتصال بالإنترنت.
      </p>
      <details className="text-sm leading-7 text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-800">الشبكة واستعادة الاتصال</summary>
        <div className="mt-3 space-y-2">
          <p>
            يمكن استخدام راوتر دون إنترنت، أو نقطة اتصال تسمح بتواصل الأجهزة فيما بينها. أبقِ جهاز المقدّم قيد
            التشغيل وأوقف وضع السكون أثناء الجلسة.
          </p>
          <p>
            إذا انقطع اتصال لاعب، تستمر اللعبة لدى الآخرين. يعود اللاعب باسمه ونقاطه عند فتح الرابط نفسه في
            المتصفح نفسه. تُحتسب الإجابة إذا وصلت قبل انتهاء وقت السؤال.
          </p>
        </div>
      </details>
    </section>
  );
}

export function LocalHistory({
  rooms,
  busy,
  onDelete,
}: {
  rooms: LocalRoom[];
  busy: boolean;
  onDelete: (room: LocalRoom) => void;
}) {
  return (
    <section className="card min-w-0 space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-brand-600">محفوظة على هذا الجهاز</p>
          <h2 className="mt-1 text-xl font-black">نتائج الجلسات السابقة</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
          {rooms.length}
        </span>
      </div>
      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
          <p className="font-bold text-slate-700">لم تنتهِ أي جلسة بعد</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            ستظهر النتائج هنا بعد انتهاء أول جلسة، ويمكنك العودة إليها لاحقاً.
          </p>
        </div>
      ) : (
        <ul className="local-history-scroll max-h-80 divide-y divide-slate-100 overflow-y-auto pe-1">
          {rooms.map((room) => (
            <li
              key={room.roomId}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-sm font-bold">{room.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  رمز الجلسة: <b dir="ltr">{room.code}</b>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <a className="text-xs font-bold text-brand-700 hover:underline" href={localRoomHref(room)}>
                  النتائج ←
                </a>
                <button
                  className="rounded-lg px-2 py-2 text-xs text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  disabled={busy}
                  aria-label={`حذف نتائج ${room.title}، الجلسة ${room.code}`}
                  onClick={() => onDelete(room)}
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
