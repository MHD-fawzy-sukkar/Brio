'use client';

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
  const { data, loading, refreshing, error: loadError, reload } = useResource<IdentityRecordDto[]>('/api/identities');
  const themes = data ?? [];
  const [editing, setEditing] = useState<IdentityRecordDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<IdentityRecordDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const visible = themes.filter(theme => theme.name.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">هوياتي البصرية</h1><p className="mt-2 text-sm leading-7 text-slate-500">أنشئ هوية بصرية أو عدّل هوياتك المحفوظة. التعديل يحدّث مسابقاتك المرتبطة، والحذف يعيدها لهوية بولت.</p></div><div className="flex flex-wrap gap-3"><Link href="/dashboard/" className="secondary-btn inline-flex items-center justify-center">→ مسابقاتي</Link><Link href="/" className="secondary-btn inline-flex items-center justify-center">الرئيسية</Link><button type="button" disabled={editing !== null} className="primary-btn" onClick={() => { setError(''); setEditing('new'); }}>＋ إضافة هوية</button></div></header>
    {(error || loadError) && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error || loadError}<button type="button" className="ms-3 underline" onClick={() => { setError(''); reload(); }}>إعادة المحاولة</button></div>}
    {editing !== null ? <section className="card p-4 sm:p-7"><IdentityEditor key={editing === 'new' ? 'new' : editing.id} libraryId={editing === 'new' ? '' : editing.id} record={editing === 'new' ? undefined : editing} defaultName="" onCancel={() => setEditing(null)} onSaved={record => { setResource('/api/identities', editing === 'new' ? [record, ...themes] : themes.map(theme => theme.id === record.id ? record : theme)); setEditing(null); }} /></section> : <>
      <label className="block"><span className="sr-only">البحث عن هوية</span><input type="search" className="field" placeholder="ابحث باسم الهوية…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {loading && <ThemeCardsSkeleton />}
      {!loading && refreshing && <p role="status" className="text-xs text-slate-500">جاري تحديث هوياتك البصرية…</p>}
      {!loading && !loadError && !visible.length && <div className="card space-y-4 p-6"><p className="text-sm text-slate-500">{query.trim() ? 'لا توجد هويات بصرية تطابق بحثك.' : 'لا توجد هويات بصرية محفوظة بعد. ابدأ بإضافة هويتك الأولى.'}</p>{!query.trim() && <button type="button" className="primary-btn" onClick={() => setEditing('new')}>＋ إضافة هوية</button>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(theme => <article key={theme.id} className="card min-w-0 p-4">
        <ThemeArtwork src={theme.identity.character.kind === 'image' ? theme.identity.character.src : theme.identity.logo?.src ?? '/bolt-original.png'} className="h-28 w-full" />
        <h2 className="mt-3 break-words font-black">{theme.name}</h2><p className="mt-1 text-xs text-slate-500">{theme.visibility === 'public' ? 'عامة' : 'خاصة'} · {theme.identity.avatars.length} أفاتار</p>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="secondary-btn flex-1" onClick={() => setEditing(theme)}>تعديل</button><button type="button" className="secondary-btn flex-1 text-rose-700" onClick={() => setDeleting(theme)}>حذف</button></div>
      </article>)}</div>
    </>}
    <ConfirmDialog open={Boolean(deleting)} title="حذف الهوية؟" description={`ستُحذف الهوية «${deleting?.name ?? ''}» من المكتبة، وستعود مسابقاتك المرتبطة بها إلى هوية بولت الافتراضية.`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={async () => {
      if (!deleting || busy) return;
      setBusy(true); setError('');
      try { await deleteLibraryTheme(deleting.id); setResource('/api/identities', themes.filter(theme => theme.id !== deleting.id)); setDeleting(null); }
      catch (cause) { setDeleting(null); setError(cause instanceof Error ? cause.message : 'تعذّر حذف الهوية.'); }
      finally { setBusy(false); }
    }} />
  </div>;
}

export default function IdentitiesPage() { return <AuthGuard><ThemeLibrary /></AuthGuard>; }
