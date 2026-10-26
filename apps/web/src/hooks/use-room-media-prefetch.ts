'use client';

import { useEffect, useState } from 'react';
import { globalMediaPrefetchEngine } from '../services/media-prefetch';

interface ManifestItem {
  mediaId: string;
  url: string;
  questionIndex: number;
  isEssential: boolean;
}

export function useRoomMediaPrefetch(roomId: string, questionIndex: number | null | undefined) {
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [, setMediaTick] = useState(0);
  useEffect(() => globalMediaPrefetchEngine.subscribe(() => setMediaTick(tick => tick + 1)), []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const loadManifest = async (attempt = 0) => {
      if (cancelled) return;
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error('Manifest unavailable');
        const items = (await response.json()) as ManifestItem[];
        if (cancelled) return;
        setManifest(items);
        globalMediaPrefetchEngine.queueImages(
          items.filter(item => item.questionIndex <= 2).map((item) => ({
            url: item.url,
            questionId: item.mediaId,
            isEssential: item.isEssential,
            priority: item.questionIndex <= 2 ? 1 : 2
          }))
        );
      } catch {
        if (!cancelled && attempt < 2) {
          retry = setTimeout(() => void loadManifest(attempt + 1), 400);
        }
      }
    };

    void loadManifest();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      controller.abort();
    };
  }, [roomId]);

  useEffect(() => {
    if (!manifest.length) return;
    const currentIdx = questionIndex ?? -1;
    const upcoming = manifest.filter(
      (item) => item.questionIndex >= Math.max(0,currentIdx) && item.questionIndex <= Math.max(0,currentIdx) + 2
    );
    for (const item of upcoming) {
      globalMediaPrefetchEngine.prioritizeUpcoming(item.url, item.isEssential);
    }
  }, [manifest, questionIndex]);

  const start = Math.max(0, questionIndex ?? 0);
  const window = manifest.filter(item => item.questionIndex >= start && item.questionIndex <= start + 2);
  return { total: window.length, ready: window.filter(item => globalMediaPrefetchEngine.isLoaded(item.url)).length,
    failed: window.filter(item => globalMediaPrefetchEngine.getState(item.url)?.status === 'error').length };
}
