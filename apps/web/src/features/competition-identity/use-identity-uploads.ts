'use client';

import { useEffect, useRef, useState } from 'react';
import { createSubmissionId } from '../../services/submission-id';
import { uploadIdentityImage, type IdentityAsset } from './api';
import { runUploadBatch } from './upload-batch';

export type PendingIdentityImage = { id: string; file: File; preview: string; status: 'queued' | 'uploading' | 'failed'; error?: string };

export function useIdentityUploads(onUploaded: (asset: IdentityAsset, file: File, uploadKey: string) => void) {
  const [pending, setPending] = useState<PendingIdentityImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const previews = useRef(new Map<string, string>());
  const uploadedCallback = useRef(onUploaded);
  uploadedCallback.current = onUploaded;
  const release = (id: string) => {
    const preview = previews.current.get(id);
    if (preview) URL.revokeObjectURL(preview);
    previews.current.delete(id);
  };
  useEffect(() => {
    mounted.current = true;
    const urls = previews.current;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const run = async (items: PendingIdentityImage[]) => {
    if (controller.current || !items.length) return;
    const batch = new AbortController();
    controller.current = batch;
    setUploading(true);
    await runUploadBatch(items, async item => {
      if (batch.signal.aborted) throw new Error('تم إلغاء الرفع. يمكنك إعادة المحاولة.');
      if (mounted.current) setPending(current => current.map(row => row.id === item.id ? { ...row, status: 'uploading', error: undefined } : row));
      return uploadIdentityImage(item.file, batch.signal);
    }, (item, result) => {
      if (!mounted.current) return;
      if (result.ok && !batch.signal.aborted) {
        uploadedCallback.current(result.value, item.file, item.id);
        setPending(current => current.filter(row => row.id !== item.id));
        release(item.id);
      } else {
        const message = batch.signal.aborted ? 'تم إلغاء الرفع. يمكنك إعادة المحاولة.'
          : !result.ok && result.error instanceof Error ? result.error.message : 'تعذّر رفع الصورة. حاول مجدداً.';
        setPending(current => current.map(row => row.id === item.id ? { ...row, status: 'failed', error: message } : row));
      }
    });
    controller.current = null;
    if (mounted.current) setUploading(false);
  };

  return {
    pending, uploading, notice, order,
    addFiles(files: readonly File[], capacity: number) {
      if (controller.current) return;
      const selected = files.slice(0, Math.max(0, capacity));
      setNotice(selected.length < files.length ? `تم اختيار ${selected.length} صورة. الحد الأقصى للهوية 20 صورة.` : '');
      const items = selected.map(file => {
        const id = createSubmissionId();
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
        if (preview) previews.current.set(id, preview);
        return { id, file, preview, status: 'queued' as const };
      });
      setPending(current => [...current, ...items]);
      setOrder(current => [...current, ...items.map(item => item.id)]);
      void run(items);
    },
    retry(id: string) { const item = pending.find(row => row.id === id); if (item) void run([item]); },
    remove(id: string) { if (!controller.current) { release(id); setPending(current => current.filter(row => row.id !== id)); } },
    cancel() { controller.current?.abort(); }
  };
}
