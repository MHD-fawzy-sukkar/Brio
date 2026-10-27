'use client';
import { t } from '../../i18n/locale';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveIdentityRequest } from '@brio/contracts';
import { createSubmissionId } from '../../services/submission-id';
import { validateImage } from '../../services/media-upload';
import { uploadIdentityImage, type IdentityAsset } from './api';
import { DeferredIdentityUploads, type LocalIdentityFile } from './deferred-uploads';
export type PendingIdentityImage = LocalIdentityFile;

export function useIdentityUploads(onStaged: (asset: IdentityAsset, file: File, uploadKey: string) => void) {
  const [, render] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onStaged);
  callback.current = onStaged;
  const queue = useRef<DeferredIdentityUploads | null>(null);
  if (!queue.current)
    queue.current = new DeferredIdentityUploads(uploadIdentityImage, () => {
      if (mounted.current) render((value) => value + 1);
    });
  const release = (id: string) => {
    const item = queue.current!.files.get(id);
    if (item) URL.revokeObjectURL(item.preview);
    queue.current!.remove(id);
  };
  useEffect(() => {
    mounted.current = true;
    const files = queue.current!.files;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      for (const item of files.values()) URL.revokeObjectURL(item.preview);
      files.clear();
    };
  }, []);
  const prepare = useCallback(
    async (input: SaveIdentityRequest, progress?: (done: number, total: number) => void) => {
      if (controller.current) throw new Error(t('انتظر اكتمال الحفظ الحالي.'));
      const batch = new AbortController();
      controller.current = batch;
      setUploading(true);
      try {
        return await queue.current!.prepare(input, batch.signal, progress);
      } finally {
        controller.current = null;
        if (mounted.current) setUploading(false);
      }
    },
    [],
  );
  return {
    pending: [...queue.current.files.values()],
    uploading,
    notice,
    prepare,
    addFiles(files: readonly File[], capacity: number) {
      if (controller.current) return;
      const selected = files.slice(0, Math.max(0, capacity));
      const messages: string[] = [];
      if (selected.length < files.length)
        messages.push(t('تم اختيار {0} صورة. الحد الأقصى 20 صورة.', { 0: selected.length }));
      for (const file of selected) {
        try {
          validateImage(file);
          const hex = createSubmissionId();
          const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20)}`;
          const preview = URL.createObjectURL(file);
          queue.current!.stage({ id, file, preview, status: 'staged' });
          callback.current({ mediaId: id, src: preview }, file, id);
        } catch (cause) {
          messages.push(cause instanceof Error ? cause.message : t('الصورة غير صالحة.'));
        }
      }
      setNotice(messages.join(' '));
    },
    retry(id: string) {
      const item = queue.current!.files.get(id);
      if (item && !controller.current) {
        item.status = item.asset ? 'uploaded' : 'staged';
        item.error = undefined;
        render((value) => value + 1);
      }
    },
    remove(id: string) {
      if (!controller.current) release(id);
    },
    cancel() {
      controller.current?.abort();
    },
  };
}
