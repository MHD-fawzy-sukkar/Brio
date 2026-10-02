export interface PrefetchItem {
  url: string;
  questionId: string;
  isEssential: boolean;
  priority: number; // 1 = highest (first 3 images / next immediate question), 2 = normal, 3 = background
}

export interface PrefetchState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  url: string;
  isEssential: boolean;
  error?: string;
  decoded: boolean;
}

export class MediaPrefetchEngine {
  private memoryCache: Map<string, { blobUrl: string; bytes: number; timestamp: number }> = new Map();
  private maxCacheEntries = 10;
  private maxMemoryBytes = 20 * 1024 * 1024; // 20MB max
  private currentMemoryBytes = 0;

  private activeFetchCount = 0;
  private maxConcurrency = 2;

  private queue: PrefetchItem[] = [];
  private inFlightAbortControllers: Map<string, AbortController> = new Map();
  private itemStates: Map<string, PrefetchState> = new Map();
  private stateListeners: Set<(states: Map<string, PrefetchState>) => void> = new Set();

  // Metrics tracking for exit gate reporting
  private totalRequestedCount = 0;
  private readyDecodedCount = 0;

  constructor() {}

  /**
   * Enqueues a set of image URLs with priority, avoiding duplicate requests for identical URLs
   */
  queueImages(items: PrefetchItem[]): void {
    for (const item of items) {
      if (!item.url) continue;

      if (this.memoryCache.has(item.url) || this.inFlightAbortControllers.has(item.url)) {
        continue;
      }

      // Check if already in queue
      const existingIdx = this.queue.findIndex((q) => q.url === item.url);
      if (existingIdx >= 0) {
        if (item.priority < this.queue[existingIdx].priority) {
          this.queue[existingIdx].priority = item.priority;
        }
      } else {
        this.queue.push(item);
        this.totalRequestedCount++;
        this.itemStates.set(item.url, {
          status: 'loading',
          url: item.url,
          isEssential: item.isEssential,
          decoded: false
        });
      }
    }

    // Sort queue by priority ascending (1 = highest)
    this.queue.sort((a, b) => a.priority - b.priority);
    this.processQueue();
  }

  /**
   * Prioritizes prefetching for an upcoming question during 3s STATS + 5s LEADERBOARD interval
   */
  prioritizeUpcoming(url: string, isEssential: boolean): void {
    if (!url) return;
    this.queueImages([{ url, questionId: 'upcoming', isEssential, priority: 1 }]);
  }

  isLoaded(url: string): boolean {
    if (!url) return true;
    return this.memoryCache.has(url);
  }

  resolveUrl(url: string): string {
    return this.memoryCache.get(url)?.blobUrl || url;
  }

  getState(url: string): PrefetchState | undefined {
    if (this.memoryCache.has(url)) {
      return { status: 'loaded', url, isEssential: true, decoded: true };
    }
    return this.itemStates.get(url);
  }

  subscribe(listener: (states: Map<string, PrefetchState>) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getMetrics(): { totalRequested: number; readyCount: number; readyRatePercentage: number } {
    const readyRatePercentage =
      this.totalRequestedCount > 0 ? Math.round((this.readyDecodedCount / this.totalRequestedCount) * 100) : 100;
    return {
      totalRequested: this.totalRequestedCount,
      readyCount: this.readyDecodedCount,
      readyRatePercentage
    };
  }

  private notifyListeners(): void {
    for (const listener of this.stateListeners) {
      listener(new Map(this.itemStates));
    }
  }

  private processQueue(): void {
    while (this.activeFetchCount < this.maxConcurrency && this.queue.length > 0) {
      const nextItem = this.queue.shift();
      if (!nextItem) break;

      this.activeFetchCount++;
      this.fetchWithRetry(nextItem, 0);
    }
  }

  private async fetchWithRetry(item: PrefetchItem, attempt: number): Promise<void> {
    const maxRetries = 3;
    const controller = new AbortController();
    this.inFlightAbortControllers.set(item.url, controller);

    try {
      let response: Response | null = null;

      // 1. Try Cache Storage API first if supported
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open('brio-media-v1');
          const cachedResponse = await cache.match(item.url);
          if (cachedResponse) {
            response = cachedResponse;
          }
        } catch {
          // Fallback seamlessly if Cache Storage is full/disabled
        }
      }

      // 2. Fetch from network if not in Cache Storage
      if (!response) {
        try {
          response = await fetch(item.url, { signal: controller.signal });
          if (response && response.ok && typeof caches !== 'undefined') {
            try {
              const cache = await caches.open('brio-media-v1');
              cache.put(item.url, response.clone());
            } catch {
              // Cache storage write failure -> preserve progress with memory cache fallback!
            }
          }
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          throw e;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`HTTP ${response?.status || 'error'} loading image`);
      }

      const blob = await response.blob();

      // 3. Image Decode Validation (createImageBitmap or HTMLImageElement)
      let decoded = false;
      if (typeof createImageBitmap !== 'undefined') {
        try {
          const bmp = await createImageBitmap(blob);
          bmp.close();
          decoded = true;
        } catch {
          decoded = false;
        }
      } else {
        decoded = true; // Environment fallback
      }

      if (decoded) {
        this.readyDecodedCount++;
      }

      const blobUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : item.url;
      this.addToCache(item.url, blobUrl, blob.size);

      this.itemStates.set(item.url, {
        status: 'loaded',
        url: item.url,
        isEssential: item.isEssential,
        decoded
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      if (attempt < maxRetries) {
        // Exponential backoff + jitter (200ms, 400ms, 800ms + random 0-100ms jitter)
        const delay = Math.pow(2, attempt) * 200 + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
        return this.fetchWithRetry(item, attempt + 1);
      } else {
        this.itemStates.set(item.url, {
          status: 'error',
          url: item.url,
          isEssential: item.isEssential,
          error: err.message || 'Image prefetch failed after retries',
          decoded: false
        });
      }
    } finally {
      this.inFlightAbortControllers.delete(item.url);
      this.activeFetchCount--;
      this.notifyListeners();
      this.processQueue();
    }
  }

  private addToCache(url: string, blobUrl: string, bytes: number): void {
    while (
      (this.memoryCache.size >= this.maxCacheEntries || this.currentMemoryBytes + bytes > this.maxMemoryBytes) &&
      this.memoryCache.size > 0
    ) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (!oldestKey) break;

      const entry = this.memoryCache.get(oldestKey);
      if (entry) {
        if (typeof URL !== 'undefined' && URL.revokeObjectURL && entry.blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(entry.blobUrl);
        }
        this.currentMemoryBytes -= entry.bytes;
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(url, { blobUrl, bytes, timestamp: Date.now() });
    this.currentMemoryBytes += bytes;
  }

  cancelObsolete(urlsToKeep: Set<string>): void {
    for (const [url, controller] of this.inFlightAbortControllers.entries()) {
      if (!urlsToKeep.has(url)) {
        controller.abort();
        this.inFlightAbortControllers.delete(url);
      }
    }
    this.queue = this.queue.filter((q) => urlsToKeep.has(q.url));
  }
}

export const globalMediaPrefetchEngine = new MediaPrefetchEngine();
