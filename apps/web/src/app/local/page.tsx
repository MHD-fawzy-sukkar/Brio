'use client';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';
import { LocalGuide, LocalHistory } from '../../components/local/LocalDashboardCards';
import { useLocalDashboard } from '../../hooks/use-local-dashboard';
import { localRoomHref } from '../../services/local-dashboard';
import { isLanMode } from '../../services/runtime-mode';

export default function LocalPage() {
  const dashboard = useLocalDashboard();
  const { info, activeRoom, pastRooms, loading, busy, error, message } = dashboard;

  if (!isLanMode)
    return (
      <section className="card mx-auto max-w-2xl space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-black">اللعب على الشبكة المحلية</h1>
        <p className="leading-8 text-slate-600">
          افتح نسخة اللعب المحلي على جهاز المقدّم، ثم أضف ملف المسابقة لتبدأ جلسة دون الحاجة إلى الإنترنت.
        </p>
        <a className="primary-btn inline-flex" href="/dashboard/">
          مسابقاتي
        </a>
      </section>
    );

  return (
    <div data-mascot-drag-root className="mx-auto w-full max-w-5xl space-y-6">
      <header className="local-welcome relative grid items-center gap-4 rounded-3xl border border-white/80 bg-white/60 p-5 sm:grid-cols-[minmax(0,1fr)_240px] sm:p-7">
        <div>
          <p className="text-xs font-bold text-brand-600">لوحة المقدّم · اللعب المحلي</p>
          <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">جهّز مسابقتك وابدأ اللعب</h1>
          <p className="mt-3 max-w-xl text-sm leading-8 text-slate-600">
            أضف مسابقة، وافتح غرفتها، وادعُ اللاعبين للانضمام من هواتفهم عبر الشبكة نفسها.
          </p>
        </div>
        <div data-mascot-flight-root className="local-mascot-stage relative hidden h-36 sm:block">
          <RoamingBolt scope="page" dragWithinPage />
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-7 text-rose-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800"
        >
          {message}
        </p>
      )}
      {loading ? (
        <p role="status" className="card p-6">
          جارٍ تحميل المسابقات…
        </p>
      ) : !info ? (
        <section className="card mx-auto max-w-xl space-y-4 p-6 sm:p-8">
          <h2 className="text-xl font-black">إدارة الجلسة من جهاز المقدّم</h2>
          <p className="leading-8 text-slate-600">
            افتح رابط المقدّم الظاهر في نافذة تشغيل اللعبة على جهازك. للانضمام كلاعب، امسح الرمز الذي يعرضه
            المقدّم.
          </p>
          <button className="primary-btn w-full" onClick={() => void dashboard.connect()}>
            إعادة المحاولة
          </button>
          <a className="block text-center font-bold text-brand-700" href="/join-game/">
            الانضمام إلى لعبة
          </a>
        </section>
      ) : (
        <>
          {activeRoom && (
            <section className="rounded-2xl border border-brand-200 bg-brand-50/80 p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-brand-700">الغرفة الحالية</p>
                  <h2 className="mt-1 break-words text-xl font-black">{activeRoom.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    رمز الانضمام: <b dir="ltr">{activeRoom.code}</b>
                  </p>
                </div>
                <a className="primary-btn shrink-0 text-center" href={localRoomHref(activeRoom)}>
                  متابعة الجلسة
                </a>
              </div>
              <div className="mt-4 flex flex-col justify-between gap-3 border-t border-brand-100 pt-4 sm:flex-row sm:items-center">
                <p className="text-sm leading-7 text-slate-600">
                  أنهِ هذه الغرفة قبل فتح أخرى. ستبقى نتائجها محفوظة.
                </p>
                <button
                  disabled={busy}
                  className="shrink-0 text-start text-sm font-bold text-rose-700 underline disabled:opacity-50"
                  onClick={dashboard.endRoom}
                >
                  إنهاء الغرفة
                </button>
              </div>
            </section>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-black">المسابقات الجاهزة</h2>
                <p className="mt-1 text-sm leading-7 text-slate-500">اختر مسابقة لفتح غرفة جديدة.</p>
              </div>
              {info.quizzes.length === 0 && (
                <div className="card p-6">
                  <p className="font-bold">لا توجد مسابقات على هذا الجهاز</p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    أضف ملف مسابقة لتظهر هنا وتصبح جاهزة للّعب.
                  </p>
                </div>
              )}
              {info.quizzes.map((quiz) => (
                <article className="card p-5" key={quiz.id}>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <h3 className="break-words font-black">{quiz.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">عدد الأسئلة: {quiz.questionCount}</p>
                      {activeRoom?.quizId === quiz.id && (
                        <p className="mt-2 text-xs font-semibold leading-6 text-amber-800">
                          قيد اللعب — أنهِ الغرفة الحالية قبل حذف المسابقة.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        className="primary-btn flex-1 whitespace-nowrap sm:flex-none"
                        disabled={busy}
                        onClick={() => dashboard.start(quiz.id)}
                      >
                        فتح غرفة
                      </button>
                      <button
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                        disabled={busy}
                        aria-label={`حذف المسابقة ${quiz.title}`}
                        onClick={() => dashboard.deleteQuiz(quiz)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  {dashboard.quizDeleteError?.quizId === quiz.id && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-7 text-rose-700"
                    >
                      {dashboard.quizDeleteError.message}
                    </p>
                  )}
                </article>
              ))}
            </section>
            <section className="card space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold text-brand-600">الأسئلة والصور في ملف واحد</p>
                <h2 className="mt-1 text-xl font-black">إضافة مسابقة</h2>
              </div>
              <p className="text-sm leading-8 text-slate-600">
                افتح صفحة تعديل مسابقتك على الموقع واختر «تنزيل للّعب المحلي»، ثم أضف الملف هنا. تُحفظ
                المسابقة وصورها على هذا الجهاز لتشغيلها دون إنترنت.
              </p>
              <label
                className={`primary-btn relative flex cursor-pointer justify-center text-center ${busy ? 'pointer-events-none opacity-50' : ''}`}
              >
                {busy ? 'جارٍ تنفيذ الطلب…' : 'اختيار ملف المسابقة'}
                <input
                  aria-label="اختيار ملف المسابقة"
                  type="file"
                  accept=".json,.brio"
                  disabled={busy}
                  onChange={(event) => {
                    dashboard.importFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <p className="text-xs leading-6 text-slate-500">
                احتفظ بالملف على جهاز المقدّم؛ فهو يتضمّن الإجابات. لا يحتاج اللاعبون إلى نسخة منه.
              </p>
            </section>
          </div>
          <div className="grid items-start gap-5 md:grid-cols-2">
            <LocalGuide />
            <LocalHistory rooms={pastRooms} busy={busy} onDelete={dashboard.deleteSession} />
          </div>
          <ConfirmDialog
            open={Boolean(dashboard.pending)}
            {...dashboard.confirmation}
            busyLabel="جارٍ تنفيذ الطلب…"
            cancelLabel="إلغاء"
            busy={busy}
            onCancel={dashboard.cancel}
            onConfirm={dashboard.confirm}
          />
        </>
      )}
    </div>
  );
}
