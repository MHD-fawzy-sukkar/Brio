'use client';
import { useTranslations } from '../../i18n/use-locale';
export function LocalDownload() {
  const { locale } = useTranslations();
  const ar = locale === 'ar';
  return (
    <section className="card mx-auto max-w-2xl space-y-5 p-6 sm:p-8">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
        Windows 10 / 11 · x64
      </span>
      <h1 className="text-2xl font-black">
        {ar ? 'شغّل Brio بدون إنترنت في مكان الفعالية' : 'Run Brio without internet at your event'}
      </h1>
      <p className="leading-8 text-slate-600">
        {ar
          ? 'ثبّت تطبيق المقدّم على اللابتوب، وشغّل اللعبة من واجهته. المشاركون يدخلون من متصفح الهاتف عبر QR على شبكة Wi-Fi نفسها، دون تنزيل أي تطبيق.'
          : 'Install the presenter app on your laptop and start the game from its window. Players join by QR in their phone browser on the same Wi-Fi, with nothing to install.'}
      </p>
      <a className="primary-btn inline-flex" href="/api/downloads/windows" download>
        {ar ? 'تنزيل Brio لويندوز' : 'Download Brio for Windows'}{' '}
        <span dir="ltr" className="ms-2 whitespace-nowrap text-xs opacity-80">
          ~34 MB · EXE
        </span>
      </a>
      <ol className="list-inside list-decimal space-y-3 text-sm leading-7 text-slate-600">
        <li>
          {ar
            ? 'نزّل المثبّت وافتحه، ثم اختر «تثبيت وفتح Brio». لا تحتاج إلى CMD أو Node.'
            : 'Download and open the installer, then choose Install and open Brio. No CMD or Node installation needed.'}
        </li>
        <li>
          {ar
            ? 'من تطبيق Brio اضغط «تشغيل اللعبة» ثم «فتح لوحة المقدّم». جرّب المثال الجاهز أو استورد مسابقتك.'
            : 'In Brio, choose Start game, then Open dashboard. Try the included demo or import your quiz.'}
        </li>
        <li>
          {ar
            ? 'شارك QR من غرفة اللعبة مع الهواتف المتصلة بنفس الشبكة، وأبقِ التطبيق واللابتوب يعملان.'
            : 'Share the room QR with phones on the same network. Keep the app and laptop running.'}
        </li>
      </ol>
      <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
        {ar
          ? 'نسخة تجريبية غير موقّعة رقمياً بعد. إذا منعها Windows، لا تتجاوز التحذير؛ استخدم اللعب عبر الموقع لحين توفير نسخة موقّعة. التطبيق للمقدّم على ويندوز فقط.'
          : 'This pilot installer is not digitally signed yet. If Windows blocks it, do not bypass the warning; use online play until a signed release is available. The presenter app is Windows only.'}
      </p>
      <p className="text-sm leading-7 text-slate-500">
        {ar
          ? 'حضّر المسابقة ونزّل ملفها وصورها من الموقع قبل الفعالية. شبكة محلية مستقرة تبقى مطلوبة. التحويل التلقائي من لعبة سحابية إلى محلية غير مدعوم.'
          : 'Prepare and download your quiz and images before the event. A stable local network is still required. Automatic cloud-to-local mid-game failover is not supported.'}
      </p>
      <div className="flex flex-wrap gap-4 text-sm font-bold">
        <a className="text-brand-700 underline" href="/dashboard/">
          {ar ? 'تحضير مسابقتي' : 'Prepare my quiz'}
        </a>
        <a className="text-slate-600 underline" href="/downloads/windows/manifest.json">
          {ar ? 'معلومات الإصدار وSHA-256' : 'Release details and SHA-256'}
        </a>
      </div>
    </section>
  );
}
