import { t } from '../../i18n/locale';
import type { SaveIdentityRequest } from '@brio/contracts';
import type { IdentityAsset } from './api';
import { runUploadBatch } from './upload-batch';

export type LocalIdentityFile = {
  id: string;
  file: File;
  preview: string;
  status: 'staged' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
  asset?: IdentityAsset;
};
/** Staging is entirely local. Only prepare(), called by an explicit save, can upload. */
export class DeferredIdentityUploads {
  readonly files = new Map<string, LocalIdentityFile>();
  constructor(
    private upload: (file: File, signal?: AbortSignal) => Promise<IdentityAsset>,
    private changed: () => void,
  ) {}
  stage(item: LocalIdentityFile) {
    this.files.set(item.id, item);
    this.changed();
  }
  remove(id: string) {
    this.files.delete(id);
    this.changed();
  }
  async prepare(
    input: SaveIdentityRequest,
    signal: AbortSignal,
    progress?: (done: number, total: number) => void,
  ): Promise<SaveIdentityRequest> {
    const used = input.images
      .map((image) => this.files.get(image.mediaId))
      .filter((item): item is LocalIdentityFile => Boolean(item));
    const pending = used.filter((item) => !item.asset);
    let done = used.length - pending.length;
    progress?.(done, used.length);
    await runUploadBatch(
      pending,
      async (item) => {
        signal.throwIfAborted();
        item.status = 'uploading';
        item.error = undefined;
        this.changed();
        return this.upload(item.file, signal);
      },
      (item, result) => {
        if (result.ok) {
          item.asset = result.value;
          item.status = 'uploaded';
          done++;
        } else {
          item.status = 'failed';
          item.error = signal.aborted
            ? t('تم إلغاء الحفظ.')
            : result.error instanceof Error
              ? result.error.message
              : t('تعذّر رفع الصورة. أعد الحفظ للمحاولة.');
        }
        progress?.(done, used.length);
        this.changed();
      },
    );
    signal.throwIfAborted();
    if (used.some((item) => !item.asset))
      throw new Error(t('تعذّر رفع بعض الصور. أعد الحفظ للمحاولة؛ الصور الناجحة لن تُرفع مرة أخرى.'));
    return {
      ...input,
      images: input.images.map((image) => ({
        ...image,
        mediaId: this.files.get(image.mediaId)?.asset?.mediaId ?? image.mediaId,
      })),
    };
  }
}
