'use client';

import { useTranslations } from '../../i18n/use-locale';

import Link from 'next/link';
import { useState } from 'react';
import type { IdentityRecordDto } from '@brio/contracts';
import { AuthGuard } from '../../components/AuthGuard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ThemeCardsSkeleton } from '../../components/Loading';
import { ThemeArtwork } from '../../features/competition-identity/ThemeArtwork';
import { IdentityEditor } from '../../features/competition-identity/IdentityEditor';
import { deleteLibraryTheme } from '../../features/competition-identity/api';
import { useResource } from '../../hooks/use-resource';
import { setResource } from '../../services/resource-cache';

function ThemeLibrary() {
  const { t, translateMessage, countNoun } = useTranslations();
  const {
    data,
    loading,
    refreshing,
    error: loadError,
    reload,
  } = useResource<IdentityRecordDto[]>('/api/identities');
  const themes = data ?? [];
  const [editing, setEditing] = useState<IdentityRecordDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<IdentityRecordDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const visible = themes.filter((theme) =>
    theme.name.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')),
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{t('هوياتي البصرية')}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {t(
              'أنشئ هوية بصرية أو عدّل هوياتك المحفوظة. التعديل يحدّث مسابقاتك المرتبطة، والحذف يعيدها لهوية بولت.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/" className="secondary-btn inline-flex items-center justify-center">
            {t('→ مسابقاتي')}
          </Link>
          <Link href="/" className="secondary-btn inline-flex items-center justify-center">
            {t('الرئيسية')}
          </Link>
          <button
            type="button"
            disabled={editing !== null}
            className="primary-btn"
            onClick={() => {
              setError('');
              setEditing('new');
            }}
          >
            {t('＋ إضافة هوية')}
          </button>
        </div>
      </header>
      {(error || loadError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {translateMessage((error || loadError) ?? '')}
          <button
            type="button"
            className="ms-3 underline"
            onClick={() => {
              setError('');
              reload();
            }}
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}
      {editing !== null ? (
        <section className="card p-4 sm:p-7">
          <IdentityEditor
            key={editing === 'new' ? 'new' : editing.id}
            libraryId={editing === 'new' ? '' : editing.id}
            record={editing === 'new' ? undefined : editing}
            defaultName=""
            onCancel={() => setEditing(null)}
            onSaved={(record) => {
              setResource(
                '/api/identities',
                editing === 'new'
                  ? [record, ...themes]
                  : themes.map((theme) => (theme.id === record.id ? record : theme)),
              );
              setEditing(null);
            }}
          />
        </section>
      ) : (
        <>
          <label className="block">
            <span className="sr-only">{t('البحث عن هوية')}</span>
            <input
              type="search"
              className="field"
              placeholder={t('ابحث باسم الهوية…')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {loading && <ThemeCardsSkeleton />}
          {!loading && refreshing && (
            <p role="status" className="text-xs text-slate-500">
              {t('جاري تحديث هوياتك البصرية…')}
            </p>
          )}
          {!loading && !loadError && !visible.length && (
            <div className="card space-y-4 p-6">
              <p className="text-sm text-slate-500">
                {query.trim()
                  ? t('لا توجد هويات بصرية تطابق بحثك.')
                  : t('لا توجد هويات بصرية محفوظة بعد. ابدأ بإضافة هويتك الأولى.')}
              </p>
              {!query.trim() && (
                <button type="button" className="primary-btn" onClick={() => setEditing('new')}>
                  {t('＋ إضافة هوية')}
                </button>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((theme) => (
              <article key={theme.id} className="card min-w-0 p-4">
                <ThemeArtwork
                  src={
                    theme.identity.character.kind === 'image'
                      ? theme.identity.character.src
                      : (theme.identity.logo?.src ?? '/bolt-original.png')
                  }
                  className="h-28 w-full"
                />
                <h2 className="mt-3 break-words font-black">{theme.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {theme.identity.avatars.length} {countNoun('صورة للاعبين', theme.identity.avatars.length)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="secondary-btn flex-1" onClick={() => setEditing(theme)}>
                    {t('تعديل')}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn flex-1 text-rose-700"
                    onClick={() => setDeleting(theme)}
                  >
                    {t('حذف')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('حذف الهوية؟')}
        description={t(
          'ستُحذف الهوية «{0}» من المكتبة، وستعود مسابقاتك المرتبطة بها إلى هوية بولت الافتراضية.',
          { 0: deleting?.name ?? '' },
        )}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting || busy) return;
          setBusy(true);
          setError('');
          try {
            await deleteLibraryTheme(deleting.id);
            setResource(
              '/api/identities',
              themes.filter((theme) => theme.id !== deleting.id),
            );
            setDeleting(null);
          } catch (cause) {
            setDeleting(null);
            setError(cause instanceof Error ? cause.message : t('تعذّر حذف الهوية.'));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export default function IdentitiesPage() {
  return (
    <AuthGuard>
      <ThemeLibrary />
    </AuthGuard>
  );
}
