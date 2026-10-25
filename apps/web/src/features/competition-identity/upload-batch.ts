export type UploadResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** A failed file never cancels the rest of the selection; at most two uploads run together. */
export async function runUploadBatch<T, R>(items: readonly T[], upload: (item: T) => Promise<R>, settled: (item: T, result: UploadResult<R>) => void) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      let result: UploadResult<R>;
      try { result = { ok: true, value: await upload(item) }; }
      catch (error) { result = { ok: false, error }; }
      settled(item, result);
    }
  }));
}
