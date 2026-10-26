'use client';

import { useEffect, useState } from 'react';
import type { ThemeSummaryDto } from '@brio/contracts';
import Link from 'next/link';
import { setThemeVisibility } from './api';
import { useResource } from '../../hooks/use-resource';
import { setResource } from '../../services/resource-cache';
import { ThemeCardsSkeleton } from '../../components/Loading';
import { ThemeArtwork } from './ThemeArtwork';
import { IdentityPreview } from './IdentityPreview';
import { PublishThemeDialog } from './PublishThemeDialog';

export function ThemeLibraryPicker({
  selected,
  onSelect,
}: {
  selected: ThemeSummaryDto | null;
  onSelect: (theme: ThemeSummaryDto | null) => void;
}) {
  const {
    data,
    loading,
    refreshing,
    error: loadError,
    reload,
  } = useResource<ThemeSummaryDto[]>('/api/themes');
  const themes = data ?? [];
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<ThemeSummaryDto | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  useEffect(() => {
    if (!data || !selected) return;
    const current = data.find((theme) => theme.id === selected.id) ?? null;
    if (JSON.stringify(current) !== JSON.stringify(selected)) onSelect(current);
  }, [data, selected, onSelect]);
  const changeVisibility = async (theme: ThemeSummaryDto, visibility: 'private' | 'public') => {
    setUpdating(theme.id);
    setError('');
    try {
      await setThemeVisibility(theme.id, visibility, visibility === 'public');
      setResource(
        '/api/themes',
        themes.map((item) => (item.id === theme.id ? { ...item, visibility } : item)),
      );
      if (selected?.id === theme.id) onSelect({ ...theme, visibility });
      setPublishing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر تغيير الإتاحة.');
      setPublishing(null);
    } finally {
      setUpdating(null);
    }
  };
  const visible = themes.filter(
    (theme) =>
      (tab === 'mine' ? theme.owned : theme.visibility === 'public') &&
      theme.name.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')),
  );
  const isLoading = !loadError && (loading || !data || (refreshing && themes.length === 0));
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
      aria-label="مكتبة الهويات البصرية"
      aria-busy={isLoading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="مصدر الهوية"
          className="inline-flex max-w-full rounded-xl bg-slate-100 p-1"
        >
          {(['mine', 'public'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-2.5 text-xs font-black transition sm:px-4 sm:text-sm ${tab === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {value === 'mine' ? 'هوياتي البصرية' : 'المكتبة العامة'}
            </button>
          ))}
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
          إدارة الهويات
        </Link>
      </div>
      <label className="relative block">
        <span className="sr-only">البحث عن هوية</span>
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
          placeholder="ابحث باسم الهوية…"
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
          جاري تحديث الهويات البصرية…
        </p>
      )}
      {(error || loadError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error || loadError}
          <button
            type="button"
            className="ms-3 font-bold underline"
            onClick={() => {
              setError('');
              reload();
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {!isLoading && !error && !loadError && !visible.length && (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
          {query.trim()
            ? 'لا توجد هويات بصرية تطابق بحثك.'
            : tab === 'mine'
              ? 'لا توجد هويات بصرية محفوظة بعد. أنشئ هوية جديدة من إعدادات الهوية لاستخدامها مجدداً.'
              : 'لا توجد هويات بصرية عامة بعد.'}
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
                    {theme.owned ? 'هويتك' : 'هوية عامة'} · {theme.identity.avatars.length} صورة للاعبين ·{' '}
                    {selected?.id === theme.id ? 'محددة ✓' : 'اضغط للاختيار'}
                  </p>
                </button>
                {theme.owned && tab === 'mine' && (
                  <button
                    type="button"
                    disabled={updating !== null}
                    className="mt-3 border-t border-slate-100 pt-2 text-xs font-bold text-brand-700"
                    onClick={() => {
                      if (theme.visibility === 'private') setPublishing(theme);
                      else void changeVisibility(theme, 'private');
                    }}
                  >
                    {updating === theme.id
                      ? 'جاري الحفظ…'
                      : theme.visibility === 'public'
                        ? 'جعلها خاصة'
                        : 'نشرها للعامة'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      <PublishThemeDialog
        open={publishing !== null}
        busy={updating !== null}
        onCancel={() => setPublishing(null)}
        onConfirm={() => {
          if (publishing) void changeVisibility(publishing, 'public');
        }}
      />
      {selected && (
        <>
          <p className="text-xs leading-6 text-slate-500">
            {selected.owned
              ? 'ترتبط المسابقة بهذه الهوية؛ تعديلها من «هوياتي البصرية» يحدّث مسابقاتك المرتبطة، وحذفها يعيدها لبولت.'
              : 'هذه الهوية العامة للاستخدام فقط: لا يمكنك تعديل شخصيتها أو شعارها أو نشرها باسمك. تحتفظ المسابقة بنسخة ثابتة لا تتأثر بتعديلات صاحبها.'}
          </p>
          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-brand-700">
              معاينة الهوية المحددة
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
