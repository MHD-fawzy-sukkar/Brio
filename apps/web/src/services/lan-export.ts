import { identityImageSources, type CompetitionIdentity } from '@brio/contracts';
import { requestJson } from './http-json';

export type LanExportSource = {
  format: 'brio-lan';
  version: 1;
  quiz: {
    identity?: CompetitionIdentity;
    questions: { essentialImage?: string | null }[];
    [key: string]: unknown;
  };
};

const MAX_IMAGE_BYTES = 500 * 1024;

async function downloadImage(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password)
    throw new Error('تعذّر تضمين إحدى الصور. أعد رفعها من صفحة تعديل المسابقة ثم حاول مجدداً.');
  const response = await fetch(url, {
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(30000),
  });
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (!response.ok || !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(contentType || ''))
    throw new Error('تعذّر تنزيل إحدى الصور. جرّب مجدداً.');
  const reader = response.body!.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('إحدى الصور أكبر من 500 كيلوبايت. استبدلها بصورة أصغر ثم أعد التنزيل.');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    sourceUrl,
    contentType,
    sha256: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(''),
    base64: btoa(binary),
  };
}

/** No downloadable artifact exists until every referenced image has been embedded. */
export async function createLanBundle(
  source: LanExportSource,
  progress: (message: string) => void,
): Promise<Blob> {
  const urls = [
    ...new Set(
      [
        ...source.quiz.questions.map((q) => q.essentialImage),
        ...identityImageSources(source.quiz.identity),
      ].filter((url): url is string => Boolean(url)),
    ),
  ];
  const media: Awaited<ReturnType<typeof downloadImage>>[] = [];
  // Two downloads at a time; a package is downloadable only when every image succeeds.
  for (let i = 0; i < urls.length; i += 2) {
    media.push(...(await Promise.all(urls.slice(i, i + 2).map(downloadImage))));
    progress(`جاري تجهيز الصور ${Math.min(i + 2, urls.length)} / ${urls.length}…`);
  }
  const blob = new Blob([JSON.stringify({ ...source, media })], { type: 'application/json' });
  if (blob.size > 48 * 1024 * 1024)
    throw new Error('حجم ملف المسابقة أكبر من 48 ميغابايت. قلّل أحجام الصور وأعد المحاولة.');
  return blob;
}

export async function downloadLanBundle(quizId: string, progress: (message: string) => void) {
  progress('جاري تجهيز نسخة المسابقة…');
  await requestJson(`/api/quizzes/${encodeURIComponent(quizId)}/publish`, { method: 'POST' });
  const source = await requestJson<LanExportSource>(`/api/quizzes/${encodeURIComponent(quizId)}/lan-export`);
  const blob = await createLanBundle(source, progress);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `brio-lan-${quizId}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
