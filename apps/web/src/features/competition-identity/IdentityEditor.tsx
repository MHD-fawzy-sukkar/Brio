'use client';

import { useEffect, useMemo, useState } from 'react';
import { SaveIdentityRequestSchema, type SaveIdentityRequest, type IdentityRecordDto } from '@brio/contracts';
import { createLibraryTheme, saveLibraryTheme, saveQuizIdentity } from './api';
import { useIdentityUploads } from './use-identity-uploads';
import { ThemeImageGallery, type DraftThemeImage, type ThemeGalleryItem } from './ThemeImageGallery';
import { assignSpecialImage } from './image-roles';
import { ThemeColorPicker } from './ThemeColorPicker';

type DraftImage = DraftThemeImage;
export type IdentityDraft = SaveIdentityRequest & {
  prepare: (progress?: (done: number, total: number) => void) => Promise<SaveIdentityRequest>;
};

type EditorProps = {
  quizId?: string;
  libraryId?: string;
  defaultName: string;
  record?: IdentityRecordDto;
  onSaved?: (record: IdentityRecordDto) => void;
  onCancel?: () => void;
  onDraftChange?: (input: IdentityDraft | null) => void;
};

function initialImages(record?: IdentityRecordDto): DraftImage[] {
  return (
    record?.images.map((image) => ({
      ...image,
      src:
        record.identity.avatars.find((avatar) => avatar.id === `identity:${image.mediaId}`)?.src ??
        (image.roles.includes('logo') ? record.identity.logo?.src : undefined) ??
        (record.identity.character.kind === 'image' ? record.identity.character.src : ''),
    })) ?? []
  );
}

export function IdentityEditor({
  quizId,
  libraryId,
  defaultName,
  record,
  onSaved,
  onCancel,
  onDraftChange,
}: EditorProps) {
  const [name, setName] = useState(record?.name ?? defaultName);
  const [accent, setAccent] = useState<SaveIdentityRequest['accent']>(record?.accent ?? 'brio');
  const [images, setImages] = useState<DraftImage[]>(() => initialImages(record));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const uploads = useIdentityUploads((asset, file, uploadKey) => {
    setImages((current) => [
      ...current,
      {
        ...asset,
        uploadKey,
        label:
          file.name
            .replace(/\.[^.]+$/, '')
            .trim()
            .slice(0, 80) || 'صورة',
        roles: current.some((image) => image.roles.includes('character'))
          ? ['avatar']
          : ['avatar', 'character'],
      },
    ]);
  });
  const remaining = Math.max(0, 20 - images.length);
  const input = useMemo(
    () =>
      SaveIdentityRequestSchema.safeParse({
        name,
        images,
        accent,
        visibility: 'private',
        publishConfirmed: false,
        avatarMode: 'auto',
        motion: 'float',
      }),
    [name, images, accent],
  );
  const blocked = uploads.uploading;
  useEffect(() => {
    onDraftChange?.(
      input.success ? { ...input.data, prepare: (progress) => uploads.prepare(input.data, progress) } : null,
    );
  }, [input, onDraftChange, uploads.prepare]);
  const saving = Boolean(quizId || libraryId !== undefined);
  const Container = saving ? 'form' : 'div';
  const gallery: ThemeGalleryItem[] = images.map((image) => ({
    key: image.uploadKey ?? image.mediaId,
    image,
    pending: uploads.pending.find(
      (item) => item.id === image.uploadKey && (item.status === 'uploading' || item.status === 'failed'),
    ),
  }));

  return (
    <Container
      className="space-y-5"
      onSubmit={async (event) => {
        if (!quizId && libraryId === undefined) return;
        event.preventDefault();
        if (busy || blocked) return;
        if (!input.success) {
          setError('اكتب اسم الهوية وأضف صورة واحدة على الأقل.');
          return;
        }
        setBusy(true);
        setError('');
        setStatus('جاري حفظ الهوية…');
        try {
          const prepared = await uploads.prepare(input.data, (done, total) => {
            if (total) setStatus(`جاري رفع الصور ${done} / ${total}…`);
          });
          setStatus('جاري حفظ الهوية…');
          onSaved?.(
            await (quizId
              ? saveQuizIdentity(quizId, prepared)
              : libraryId
                ? saveLibraryTheme(libraryId, prepared)
                : createLibraryTheme(prepared)),
          );
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'تعذّر حفظ الهوية.');
        } finally {
          setBusy(false);
          setStatus('');
        }
      }}
    >
      <h2 className="text-xl font-black">{record ? 'تعديل الهوية' : 'إنشاء هوية جديدة'}</h2>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
        <div className="identity-editor-intro">
          <label className="block">
            <span className="label">اسم الهوية</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              placeholder="مثال: فريق أثر"
            />
          </label>
          <div
            className={
              gallery.length
                ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3'
                : 'rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-5 text-center'
            }
          >
            <div>
              <p className="font-black">{gallery.length ? 'صور الهوية' : 'ابدأ برفع صور جهتك'}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {gallery.length
                  ? `${images.length} صورة مختارة · حتى 20 صورة`
                  : 'اختر الصور معاً. سنوحّد مقاساتها تلقائياً. حتى 20 صورة، و5MB لكل صورة.'}
              </p>
            </div>
            <label
              className={`secondary-btn inline-block ${gallery.length ? '' : 'mt-3'} ${uploads.uploading || !remaining ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            >
              ＋ إضافة صور
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/avif"
                disabled={uploads.uploading || !remaining}
                className="sr-only"
                onChange={(event) => {
                  uploads.addFiles(Array.from(event.target.files ?? []), remaining);
                  event.target.value = '';
                }}
              />
            </label>
            {uploads.notice && (
              <p role="status" className="mt-2 text-sm text-slate-600">
                {uploads.notice}
              </p>
            )}
          </div>
        </div>
        {gallery.length > 0 && (
          <ThemeImageGallery
            items={gallery}
            accent={accent}
            uploading={uploads.uploading}
            onAssign={(role, id) => setImages((current) => assignSpecialImage(current, role, id))}
            onRemove={(id) => {
              const image = images.find((item) => item.mediaId === id);
              if (image?.uploadKey) uploads.remove(image.uploadKey);
              setImages((current) => current.filter((item) => item.mediaId !== id));
            }}
            onRetry={uploads.retry}
            onRemovePending={(id) => {
              uploads.remove(id);
              setImages((current) => current.filter((item) => item.uploadKey !== id));
            }}
          />
        )}
        <p className="text-xs leading-6 text-slate-500">
          الصور تظهر بهذا الشكل عند الانضمام. من ⋯ عيّن الرئيسية أو الشعار أو احذف الصورة. الشعار لا يظهر ضمن
          أفاتارات اللاعبين. عند وجود أقل من 5 أفاتارات تُضاف صور بولت؛ من 5 وفوق تظهر صورك فقط.
        </p>
        <div className="identity-editor-options space-y-3">
          <div>
            <span className="label">لون التفاصيل داخل المسابقة</span>
            <ThemeColorPicker value={accent} onChange={setAccent} />
            <p className="mt-2 text-xs text-slate-500">
              لون الترويسة والأزرار وبطاقات المسابقة وإطارات الأفاتارات. ألوان الإجابات وخلفية Brio تبقى
              ثابتة.
            </p>
          </div>
        </div>
      </fieldset>
      {quizId && (
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          التعديل يخص هذه المسابقة فقط. لا يغيّر الهوية الأصلية أو مسابقات أخرى.
        </p>
      )}
      <p role="status" className="text-sm text-slate-500">
        {status ||
          (uploads.uploading
            ? 'جاري رفع الصور…'
            : uploads.pending.some((item) => item.status === 'failed')
              ? 'أعد الحفظ لمحاولة الصور المتعثرة أو أزلها.'
              : libraryId !== undefined
                ? record
                  ? 'تعديل الهوية يحدّث مسابقاتك المرتبطة بها.'
                  : 'الصور محلية حتى تضغط «حفظ الهوية».'
                : 'الصور للمعاينة على جهازك فقط؛ يبدأ رفعها عند حفظ الهوية أو إنشاء المسابقة.')}
      </p>
      {saving && (
        <div className="flex flex-wrap gap-3">
          <button disabled={busy || blocked || !input.success} type="submit" className="primary-btn">
            حفظ الهوية
          </button>
          <button disabled={busy} type="button" onClick={onCancel} className="secondary-btn">
            إلغاء
          </button>
        </div>
      )}
    </Container>
  );
}
