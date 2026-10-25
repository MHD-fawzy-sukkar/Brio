'use client';

import { useEffect, useMemo, useState } from 'react';
import { createCompetitionIdentity, SaveIdentityRequestSchema, type SaveIdentityRequest, type IdentityRecordDto } from '@brio/contracts';
import { saveQuizIdentity } from './api';
import { useIdentityUploads } from './use-identity-uploads';
import { IdentityPreview } from './IdentityPreview';
import { assignSpecialImage } from './image-roles';
import { THEME_PALETTES } from './theme-palette';
import { PublishThemeDialog } from './PublishThemeDialog';

type DraftImage = SaveIdentityRequest['images'][number] & { src: string; uploadKey?: string };
type EditorProps = { quizId?: string; defaultName: string; record?: IdentityRecordDto; onSaved?: (record: IdentityRecordDto) => void; onCancel?: () => void; onDraftChange?: (input: SaveIdentityRequest | null) => void };

function initialImages(record?: IdentityRecordDto): DraftImage[] {
  return record?.images.map(image => ({ ...image, src:
    record.identity.avatars.find(avatar => avatar.id === `identity:${image.mediaId}`)?.src
    ?? (image.roles.includes('logo') ? record.identity.logo?.src : undefined)
    ?? (record.identity.character.kind === 'image' ? record.identity.character.src : '')
  })) ?? [];
}

export function IdentityEditor({ quizId, defaultName, record, onSaved, onCancel, onDraftChange }: EditorProps) {
  const [name, setName] = useState(record?.name ?? defaultName);
  const [accent, setAccent] = useState<SaveIdentityRequest['accent']>(record?.accent ?? 'brio');
  const [visibility, setVisibility] = useState<SaveIdentityRequest['visibility']>('private');
  const [publishOpen, setPublishOpen] = useState(false);
  const [images, setImages] = useState<DraftImage[]>(() => initialImages(record));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const uploads = useIdentityUploads((asset, file, uploadKey) => {
    setImages(current => [...current, { ...asset, uploadKey, label: file.name.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'صورة',
      roles: current.some(image => image.roles.includes('character')) ? ['avatar'] : ['avatar', 'character'] }]);
  });
  const remaining = Math.max(0, 20 - images.length - uploads.pending.length);
  const input = useMemo(() => SaveIdentityRequestSchema.safeParse({ name, images, accent, visibility: quizId ? 'private' : visibility, publishConfirmed: !quizId && visibility === 'public', avatarMode: 'auto', motion: 'float' }), [name, images, accent, visibility, quizId]);
  const blocked = uploads.uploading || uploads.pending.length > 0;
  useEffect(() => { onDraftChange?.(input.success && !blocked ? input.data : null); }, [input, blocked, onDraftChange]);
  const Container = quizId ? 'form' : 'div';
  const preview = input.success ? createCompetitionIdentity(input.data, new Map(images.map(image => [image.mediaId, image.src]))) : null;
  const gallery: { key: string; image?: DraftImage; pending?: typeof uploads.pending[number] }[] = [
    ...images.filter(image => !image.uploadKey).map(image => ({ key: image.mediaId, image })),
    ...uploads.order.map(key => ({ key, image: images.find(image => image.uploadKey === key), pending: uploads.pending.find(item => item.id === key) }))
  ].filter(item => item.image || ('pending' in item && item.pending));

  return <Container className="space-y-5" onSubmit={async event => {
    if (!quizId) return;
    event.preventDefault();
    if (busy || blocked) return;
    if (!input.success) { setError('اكتب اسم الثيم وأضف صورة واحدة على الأقل.'); return; }
    setBusy(true); setError(''); setStatus('جاري حفظ الثيم…');
    try { onSaved?.(await saveQuizIdentity(quizId, input.data)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر حفظ الثيم.'); }
    finally { setBusy(false); setStatus(''); }
  }}>
    <h2 className="text-xl font-black">{record ? 'تعديل الثيم' : 'إنشاء ثيم جديد'}</h2>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
      <div className="identity-editor-intro">
      <label className="block"><span className="label">اسم الثيم</span><input required maxLength={80} value={name} onChange={event => setName(event.target.value)} className="field" placeholder="مثال: فريق أثر" /></label>
      <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-5 text-center">
        <p className="font-black">ابدأ برفع صور جهتك</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">اختر الصور معاً. سنوحّد مقاساتها تلقائياً. حتى 20 صورة، و5MB لكل صورة.</p>
        <label className={`secondary-btn mt-3 inline-block ${uploads.uploading || !remaining ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
          ＋ إضافة صور
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" disabled={uploads.uploading || !remaining} className="sr-only" onChange={event => { uploads.addFiles(Array.from(event.target.files ?? []), remaining); event.target.value = ''; }} />
        </label>
        <p className="mt-2 text-xs text-slate-500">{images.length} صورة جاهزة · متاح إضافة {remaining}</p>
        {uploads.notice && <p role="status" className="mt-2 text-sm text-slate-600">{uploads.notice}</p>}
        {uploads.uploading && <button type="button" onClick={uploads.cancel} className="mt-3 text-sm font-bold text-brand-700">إلغاء الرفع المتبقي</button>}
      </div>
      </div>
      {gallery.length > 0 && <ul className="identity-image-gallery grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="صور الثيم">
        {gallery.map(({ key, image, pending }) => {
          const src = image?.src ?? pending?.preview;
          return <li key={key} className="theme-image-card">
            <div className="theme-image-card__art">{src ? <img src={src} alt="" decoding="async" /> : <span className="text-3xl text-slate-300">▧</span>}
              <span className="theme-image-card__badge">{image ? image.roles.includes('logo') ? 'الشعار' : image.roles.includes('character') ? 'الشخصية' : 'أفاتار' : pending?.status === 'failed' ? 'تعذّر الرفع' : 'جاري الرفع…'}</span>
            </div>
            <div className="p-2">
              {image ? <input aria-label="وصف الصورة" className="theme-image-card__caption w-full min-w-0 truncate rounded-lg border border-transparent bg-transparent px-1 text-xs focus:border-brand-300" required maxLength={80} value={image.label} onChange={event => setImages(current => current.map(row => row.mediaId === image.mediaId ? { ...row, label: event.target.value } : row))} /> : <p className="theme-image-card__caption truncate px-1 text-xs text-slate-600">{pending?.file.name}</p>}
              <div className="flex h-8 items-center justify-between gap-2">
                {image ? <><span className="text-xs text-emerald-700">جاهزة ✓</span><button type="button" aria-label={`إزالة ${image.label}`} onClick={() => setImages(current => current.filter(row => row.mediaId !== image.mediaId))} className="text-xs font-bold text-rose-700">إزالة</button></>
                  : pending?.status === 'failed' ? <><button type="button" disabled={uploads.uploading} className="text-xs font-bold text-brand-700" onClick={() => uploads.retry(pending.id)}>إعادة المحاولة</button><button type="button" disabled={uploads.uploading} onClick={() => uploads.remove(pending.id)} className="text-xs text-rose-700">إزالة</button></> : <span role="status" className="text-xs text-slate-500">{pending?.status === 'queued' ? 'بانتظار الدور…' : 'نعالج الصورة ونرفعها…'}</span>}
              </div>
            </div>
            {pending?.error && <p role="alert" className="px-3 pb-3 text-xs text-rose-700">{pending.error}</p>}
          </li>;
        })}
      </ul>}
      {images.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
        {(['logo', 'character'] as const).map(role => {
          const selected = images.find(image => image.roles.includes(role));
          return <div key={role} className="rounded-2xl border border-slate-200 p-3">
            <div className="mb-3 flex items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-50">{selected ? <img src={selected.src} alt="" className="h-full w-full object-contain" /> : <span className="text-xl">{role === 'logo' ? '◇' : '⚡'}</span>}</div><div><p className="text-sm font-black">{role === 'logo' ? 'شعار الجهة' : 'الشخصية الرئيسية'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{role === 'logo' ? 'للأماكن المخصصة للشعار فقط' : 'تطير وتظهر كشخصية الثيم'}</p></div></div>
            <select aria-label={role === 'logo' ? 'شعار الجهة' : 'الشخصية الرئيسية'} className="field text-sm" value={selected?.mediaId ?? ''} onChange={event => setImages(current => assignSpecialImage(current, role, event.target.value))}>
              <option value="">{role === 'logo' ? 'بدون شعار' : 'بولت الافتراضي'}</option>
              {images.map(image => <option key={image.mediaId} value={image.mediaId}>{image.label}</option>)}
            </select>
          </div>;
        })}
      </div>}
      <p className="text-xs leading-6 text-slate-500">باقي الصور أفاتارات تلقائياً. عند وجود أقل من 5 أفاتارات تُضاف صور بولت؛ من 5 وفوق تظهر صورك فقط.</p>
      <div className="identity-editor-options grid gap-5 md:grid-cols-2">
      <div><span className="label">لون التفاصيل داخل المسابقة</span><div className="flex flex-wrap gap-2">{Object.entries(THEME_PALETTES).map(([key, palette]) => <button key={key} type="button" aria-pressed={accent === key} onClick={() => setAccent(key as typeof accent)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${accent === key ? 'border-slate-800 bg-slate-50' : 'border-slate-200'}`}><span className="h-4 w-4 rounded-full" style={{ backgroundColor: palette.color }} />{palette.label}</button>)}</div><p className="mt-2 text-xs text-slate-500">لون الترويسة والأزرار وبطاقات المسابقة وإطارات الأفاتارات. ألوان الإجابات وخلفية Brio تبقى ثابتة.</p></div>
      {!quizId && <label className="block"><span className="label">إتاحة الثيم</span><select className="field" value={visibility} onChange={event => { if (event.target.value === 'public') setPublishOpen(true); else setVisibility('private'); }}><option value="private">خاص — أستخدمه في مسابقاتي</option><option value="public">عام — يمكن للآخرين استخدام صوره وثيمه</option></select><span className="mt-2 block text-xs leading-6 text-slate-500">{visibility === 'public' ? 'عند الحفظ سيظهر اسم الثيم وصوره في المكتبة العامة، ويمكن للآخرين حفظ نسخة منه.' : 'يُحفظ في مكتبتك لإعادة استخدامه. لا يظهر في المكتبة العامة؛ يظهر للمشاركين داخل مسابقاتك.'}</span></label>}
      </div>
    </fieldset>
    {quizId && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">التعديل يخص هذه المسابقة فقط. لا يغيّر الثيم الأصلي أو مسابقات أخرى، ولا ينشر التعديل للعامة.</p>}
    <PublishThemeDialog open={publishOpen} onCancel={() => setPublishOpen(false)} onConfirm={() => { setVisibility('public'); setPublishOpen(false); }} />
    {preview && <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-black text-brand-700">معاينة الهوية والأفاتارات داخل المسابقة</summary><div className="p-3"><IdentityPreview identity={preview} /></div></details>}
    <p role="status" className="text-sm text-slate-500">{status || (uploads.uploading ? 'جاري رفع الصور…' : uploads.pending.length ? 'أعد محاولة الصور المتعثرة أو أزلها قبل الحفظ.' : 'يُحفظ الثيم مع المسابقة ويمكن استخدامه مرة أخرى.')}</p>
    {quizId && <div className="flex gap-3"><button disabled={busy || blocked || !input.success} type="submit" className="primary-btn">حفظ الثيم</button><button disabled={busy} type="button" onClick={onCancel} className="secondary-btn">إلغاء</button></div>}
  </Container>;
}
