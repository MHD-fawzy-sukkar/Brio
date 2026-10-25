'use client';

import { useEffect, useMemo, useState } from 'react';
import { SaveIdentityRequestSchema, type SaveIdentityRequest, type IdentityRecordDto } from '@brio/contracts';
import { saveQuizIdentity } from './api';
import { useIdentityUploads } from './use-identity-uploads';
import { ThemeImageGallery, type DraftThemeImage, type ThemeGalleryItem } from './ThemeImageGallery';
import { assignSpecialImage } from './image-roles';
import { ThemeColorPicker } from './ThemeColorPicker';
import { PublishThemeDialog } from './PublishThemeDialog';

type DraftImage = DraftThemeImage;
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
  const gallery: ThemeGalleryItem[] = [
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
      <div className={gallery.length ? "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3" : "rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-5 text-center"}>
        <div><p className="font-black">{gallery.length ? "صور الثيم" : "ابدأ برفع صور جهتك"}</p>
        <p className="mt-1 text-xs leading-6 text-slate-500">{gallery.length ? `${images.length} صورة جاهزة · حتى 20 صورة` : "اختر الصور معاً. سنوحّد مقاساتها تلقائياً. حتى 20 صورة، و5MB لكل صورة."}</p></div>
        <label className={`secondary-btn inline-block ${gallery.length ? '' : 'mt-3'} ${uploads.uploading || !remaining ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
          ＋ إضافة صور
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" disabled={uploads.uploading || !remaining} className="sr-only" onChange={event => { uploads.addFiles(Array.from(event.target.files ?? []), remaining); event.target.value = ''; }} />
        </label>
        {uploads.notice && <p role="status" className="mt-2 text-sm text-slate-600">{uploads.notice}</p>}
        {uploads.uploading && <button type="button" onClick={uploads.cancel} className="mt-3 text-sm font-bold text-brand-700">إلغاء الرفع المتبقي</button>}
      </div>
      </div>
      {gallery.length > 0 && <ThemeImageGallery items={gallery} accent={accent} uploading={uploads.uploading}
        onAssign={(role, id) => setImages(current => assignSpecialImage(current, role, id))}
        onRemove={id => setImages(current => current.filter(image => image.mediaId !== id))}
        onRetry={uploads.retry} onRemovePending={uploads.remove} />}
      <p className="text-xs leading-6 text-slate-500">الصور تظهر بهذا الشكل عند الانضمام. من ⋯ عيّن الرئيسية أو الشعار أو احذف الصورة. الشعار لا يظهر ضمن أفاتارات اللاعبين. عند وجود أقل من 5 أفاتارات تُضاف صور بولت؛ من 5 وفوق تظهر صورك فقط.</p>
      <div className="identity-editor-options grid gap-5 md:grid-cols-2">
      <div><span className="label">لون التفاصيل داخل المسابقة</span><ThemeColorPicker value={accent} onChange={setAccent} /><p className="mt-2 text-xs text-slate-500">لون الترويسة والأزرار وبطاقات المسابقة وإطارات الأفاتارات. ألوان الإجابات وخلفية Brio تبقى ثابتة.</p></div>
      {!quizId && <label className="block"><span className="label">إتاحة الثيم</span><select className="field" value={visibility} onChange={event => { if (event.target.value === 'public') setPublishOpen(true); else setVisibility('private'); }}><option value="private">خاص — أستخدمه في مسابقاتي</option><option value="public">عام — يمكن للآخرين استخدام صوره وثيمه</option></select><span className="mt-2 block text-xs leading-6 text-slate-500">{visibility === 'public' ? 'عند الحفظ سيظهر اسم الثيم وصوره في المكتبة العامة، ويمكن للآخرين حفظ نسخة منه.' : 'يُحفظ في مكتبتك لإعادة استخدامه. لا يظهر في المكتبة العامة؛ يظهر للمشاركين داخل مسابقاتك.'}</span></label>}
      </div>
    </fieldset>
    {quizId && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">التعديل يخص هذه المسابقة فقط. لا يغيّر الثيم الأصلي أو مسابقات أخرى، ولا ينشر التعديل للعامة.</p>}
    <PublishThemeDialog open={publishOpen} onCancel={() => setPublishOpen(false)} onConfirm={() => { setVisibility('public'); setPublishOpen(false); }} />
    <p role="status" className="text-sm text-slate-500">{status || (uploads.uploading ? 'جاري رفع الصور…' : uploads.pending.length ? 'أعد محاولة الصور المتعثرة أو أزلها قبل الحفظ.' : 'يُحفظ الثيم مع المسابقة ويمكن استخدامه مرة أخرى.')}</p>
    {quizId && <div className="flex gap-3"><button disabled={busy || blocked || !input.success} type="submit" className="primary-btn">حفظ الثيم</button><button disabled={busy} type="button" onClick={onCancel} className="secondary-btn">إلغاء</button></div>}
  </Container>;
}
