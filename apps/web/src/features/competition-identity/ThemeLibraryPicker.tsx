'use client';

import { useTranslations } from '../../i18n/use-locale';

import { useEffect, useState } from 'react';
import type { ThemeSummaryDto } from '@brio/contracts';
import Link from 'next/link';
import { useResource } from '../../hooks/use-resource';
import { ThemeCardsSkeleton } from '../../components/Loading';
import { ThemeArtwork } from './ThemeArtwork';
import { IdentityPreview } from './IdentityPreview';

export function ThemeLibraryPicker({
  selected,
  onSelect,
}: {
  selected: ThemeSummaryDto | null;
  onSelect: (theme: ThemeSummaryDto | null) => void;
}) {
  const { t, translateMessage, countNoun } = useTranslations();
  const {
    data,
    loading,
    refreshing,
    error: loadError,
    reload,
  } = useResource<ThemeSummaryDto[]>('/api/themes');
  const themes = (data ?? []).filter((theme) => theme.owned);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!data || !selected) return;
    const current = data.find((theme) => theme.owned && theme.id === selected.id) ?? null;
    if (JSON.stringify(current) !== JSON.stringify(selected)) onSelect(current);
  }, [data, selected, onSelect]);
  const visible = themes.filter((theme) =>
    theme.name.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')),
  );
  const isLoading = !loadError && (loading || !data || (refreshing && themes.length === 0));
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
      aria-label={t('مكتبة الهويات البصرية')}
      aria-busy={isLoading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{t('هوياتي البصرية')}</h3>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            {t('اختر من هوياتك المحفوظة لإعادة استخدامها في هذه المسابقة.')}
          </p>
        </div>
        <Link
          href="/identities/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
          </svg>
          {t('إدارة الهويات')}
        </Link>
      </div>
      <label className="relative block">
        <span className="sr-only">{t('البحث عن هوية')}</span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="search"
          className="field !min-h-11 !bg-white !pe-11 !text-sm"
          placeholder={t('ابحث باسم الهوية…')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {isLoading && <ThemeCardsSkeleton compact />}
      {!isLoading && refreshing && (
        <p role="status" className="text-xs text-slate-500">
          {t('جاري تحديث الهويات البصرية…')}
        </p>
      )}
      {loadError && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {translateMessage(loadError ?? '')}
          <button
            type="button"
            className="ms-3 font-bold underline"
            onClick={() => {
              reload();
            }}
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}
      {!isLoading && !loadError && !visible.length && (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
          {query.trim()
            ? t('لا توجد هويات بصرية تطابق بحثك.')
            : t('لا توجد هويات بصرية محفوظة بعد. أنشئ هوية جديدة من إعدادات الهوية لاستخدامها مجدداً.')}
        </p>
      )}
      {!isLoading && (
        <div className="theme-library-gallery grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((theme) => {
            const cover =
              theme.identity.character.kind === 'image'
                ? theme.identity.character.src
                : (theme.identity.logo?.src ?? '/bolt-original.png');
            return (
              <article
                key={theme.id}
                className={`min-w-0 rounded-2xl border p-3 ${selected?.id === theme.id ? 'border-brand-500 bg-white ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'}`}
              >
                <button
                  type="button"
                  aria-pressed={selected?.id === theme.id}
                  onClick={() => onSelect(theme)}
                  className="relative w-full text-start"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute end-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${selected?.id === theme.id ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-transparent'}`}
                  >
                    ✓
                  </span>
                  <ThemeArtwork src={cover} className="mx-auto h-24 w-full rounded-xl bg-slate-50 p-2" />
                  <p className="mt-2 truncate text-sm font-black">{theme.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {theme.identity.avatars.length}{' '}
                    {countNoun('صورة للاعبين ·', theme.identity.avatars.length)}{' '}
                    {selected?.id === theme.id ? t('محددة ✓') : t('اضغط للاختيار')}
                  </p>
                </button>
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <>
          <p className="text-xs leading-6 text-slate-500">
            {t(
              'ترتبط المسابقة بهذه الهوية؛ تعديلها من «هوياتي البصرية» يحدّث مسابقاتك المرتبطة، وحذفها يعيدها لبولت.',
            )}
          </p>
          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-brand-700">
              {t('معاينة الهوية المحددة')}
            </summary>
            <div className="p-3">
              <IdentityPreview key={selected.id} identity={{ ...selected.identity, avatarMode: 'auto' }} />
            </div>
          </details>
        </>
      )}
    </section>
  );
}
