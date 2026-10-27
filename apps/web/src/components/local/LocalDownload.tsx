'use client';
import Link from 'next/link';
import { useTranslations } from '../../i18n/use-locale';
import { localDownloadCopy } from './local-download-copy';

export function LocalDownload() {
  const { locale } = useTranslations();
  const copy = localDownloadCopy[locale];
  return (
    <div className="mx-auto max-w-5xl space-y-8 py-3 text-start sm:space-y-10 sm:py-6">
      <section
        aria-labelledby="local-download-title"
        className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12"
      >
        <div>
          <p className="mb-4 text-sm font-bold text-brand-700">{copy.eyebrow}</p>
          <h1
            id="local-download-title"
            className="max-w-xl text-3xl font-black leading-[1.65] tracking-tight text-slate-900 sm:text-4xl sm:leading-[1.55]"
          >
            {copy.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">{copy.description}</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-700">
            {copy.features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-sm"
                >
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.75rem] border border-white bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"
            >
              <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" focusable="false">
                <path d="M2 3h9v8H2zm11 0h9v8h-9zM2 13h9v8H2zm11 0h9v8h-9z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{copy.presenter}</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">{copy.platform}</h2>
            </div>
          </div>
          <a
            href="/api/downloads/windows"
            download
            className="primary-btn flex w-full items-center justify-center gap-3 !px-3 !py-4 text-center text-sm sm:text-base"
          >
            <svg
              aria-hidden="true"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              focusable="false"
            >
              <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
            </svg>
            <span>{copy.download}</span>
          </a>
          <p className="mt-3 text-center text-xs leading-6 text-slate-500">{copy.downloadNote}</p>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold leading-7 text-slate-700">{copy.playerNote}</p>
            <p className="mt-2 text-xs text-slate-400">
              <bdi dir="ltr">Windows 10 / 11 · x64</bdi>
            </p>
          </div>
          <Link
            href="/dashboard/"
            className="mt-5 block text-center text-sm font-bold leading-7 text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
          >
            {copy.prepare}
          </Link>
        </div>
      </section>
      <section aria-labelledby="local-steps-title">
        <h2 id="local-steps-title" className="mb-4 text-lg font-black text-slate-900">
          {copy.stepsTitle}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-white/90 bg-white/75 p-5">
              <span
                aria-hidden="true"
                className="mb-3 grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm font-black text-brand-700"
              >
                {(index + 1).toLocaleString(locale)}
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="grid gap-5 border-t border-slate-200/70 pt-6 text-sm leading-7 sm:grid-cols-2 sm:gap-8">
        <div>
          <h2 className="font-bold text-slate-700">{copy.noteTitle}</h2>
          <p className="mt-1 text-slate-500">{copy.note}</p>
        </div>
        <div>
          <h2 className="font-bold text-slate-700">{copy.pilotTitle}</h2>
          <p className="mt-1 text-slate-500">{copy.pilot}</p>
          <Link href="/" className="mt-2 inline-block font-bold text-brand-700 underline underline-offset-4">
            {copy.online}
          </Link>
        </div>
      </div>
    </div>
  );
}
