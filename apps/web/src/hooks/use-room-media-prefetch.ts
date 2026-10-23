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

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const controller = new AbortController();

    const loadManifest = async (attempt = 0) => {
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media`, { signal: controller.signal });
        if (!response.ok) throw new Error('Manifest unavailable');
        const items = (await response.json()) as ManifestItem[];
        if (cancelled) return;
        setManifest(items);
        globalMediaPrefetchEngine.queueImages(
          items.map((item) => ({
            url: item.url,
            questionId: item.mediaId,
            isEssential: item.isEssential,
            priority: item.questionIndex <= 2 ? 1 : 2
          }))
        );
      } catch {
        if (!cancelled && attempt < 2) {
          setTimeout(() => void loadManifest(attempt + 1), 400);
        }
      }
    };

    void loadManifest();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [roomId]);

  useEffect(() => {
    if (!manifest.length) return;
    const currentIdx = questionIndex ?? -1;
    const upcoming = manifest.filter(
      (item) => item.questionIndex >= currentIdx && item.questionIndex <= currentIdx + 2
    );
    for (const item of upcoming) {
      globalMediaPrefetchEngine.prioritizeUpcoming(item.url, item.isEssential);
    }
  }, [manifest, questionIndex]);
}
