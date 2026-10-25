'use client';

import { useEffect, useState } from 'react';
import type { ThemeSummaryDto } from '@brio/contracts';
import { getThemes, setThemeVisibility } from './api';
import { IdentityPreview } from './IdentityPreview';
import { PublishThemeDialog } from './PublishThemeDialog';

export function ThemeLibraryPicker({ selected, onSelect }: { selected: ThemeSummaryDto | null; onSelect: (theme: ThemeSummaryDto | null) => void }) {
  const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [publishing, setPublishing] = useState<ThemeSummaryDto | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getThemes(controller.signal).then(result => { if (!controller.signal.aborted) setThemes(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذّر تحميل الثيمات.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const changeVisibility = async (theme: ThemeSummaryDto, visibility: 'private' | 'public') => {
    setUpdating(theme.id); setError('');
    try {
      await setThemeVisibility(theme.id, visibility, visibility === 'public');
      setThemes(current => current.map(item => item.id === theme.id ? { ...item, visibility } : item));
      if (selected?.id === theme.id) onSelect({ ...theme, visibility });
      setPublishing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تغيير الإتاحة.'); setPublishing(null); }
    finally { setUpdating(null); }
  };
  const visible = themes.filter(theme => tab === 'mine' ? theme.owned : theme.visibility === 'public');
  return <section className="space-y-4" aria-label="مكتبة الثيمات">
    <div className="flex gap-2">{(['mine', 'public'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={tab === value ? 'primary-btn' : 'secondary-btn'}>{value === 'mine' ? 'ثيماتي' : 'الثيمات العامة'}</button>)}</div>
    {tab === 'mine' && <p className="text-xs leading-6 text-slate-500">النشر يتيح اسم الثيم وصوره للآخرين. تحويله لخاص يوقف ظهوره للعامة، وتبقى النسخ التي استخدموها سابقاً مستقلة.</p>}
    {loading && <p role="status" className="text-sm text-slate-500">جاري تحميل الثيمات…</p>}
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}<button type="button" className="ms-3 font-bold underline" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></div>}
    {!loading && !error && !visible.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">{tab === 'mine' ? 'لم تحفظ ثيماً بعد. اختر «ثيم جديد»؛ سيُحفظ في مكتبتك عند إنشاء المسابقة.' : 'لا توجد ثيمات عامة بعد.'}</p>}
    <div className="theme-library-gallery grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map(theme => {
      const cover = theme.identity.character.kind === 'image' ? theme.identity.character.src : theme.identity.logo?.src ?? '/bolt-original.png';
      return <article key={theme.id} className={`min-w-0 rounded-2xl border p-3 ${selected?.id === theme.id ? 'border-brand-600 bg-brand-50/40' : 'border-slate-200'}`}>
        <button type="button" aria-pressed={selected?.id === theme.id} onClick={() => onSelect(theme)} className="w-full text-start">
          <img src={cover} alt="" className="mx-auto h-24 w-full object-contain" />
          <p className="mt-2 truncate text-sm font-black">{theme.name}</p><p className="mt-1 text-xs text-slate-500">{theme.owned ? 'ثيمك' : 'ثيم عام'} · {theme.identity.avatars.length} أفاتار · {selected?.id === theme.id ? 'محدد ✓' : 'استخدام الثيم'}</p>
        </button>
        {theme.owned && tab === 'mine' && <button type="button" disabled={updating !== null} className="mt-3 text-xs font-bold text-brand-700" onClick={() => {
          if (theme.visibility === 'private') setPublishing(theme);
          else void changeVisibility(theme, 'private');
        }}>{updating === theme.id ? 'جاري الحفظ…' : theme.visibility === 'public' ? 'جعله خاصاً' : 'نشره للعامة'}</button>}
      </article>;
    })}</div>
    <PublishThemeDialog open={publishing !== null} busy={updating !== null} onCancel={() => setPublishing(null)} onConfirm={() => { if (publishing) void changeVisibility(publishing, 'public'); }} />
    {selected && <><p className="text-xs leading-6 text-slate-500">{selected.owned ? 'ستحصل المسابقة على نسخة خاصة؛ تعديلها لا يغيّر الثيم الأصلي أو مسابقاتك الأخرى.' : 'هذا الثيم العام للاستخدام فقط: لا يمكنك تعديل شخصيته أو شعاره أو نشره باسمك. تحتفظ المسابقة بنسخة ثابتة لا تتأثر بتعديلات صاحبه.'}</p><details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-black text-brand-700">معاينة الثيم المحدد</summary><div className="p-3"><IdentityPreview key={selected.id} identity={{ ...selected.identity, avatarMode: 'auto' }} /></div></details></>}
  </section>;
}
