import type { MediaVariantsDto } from '@brio/contracts';
import { globalMediaPrefetchEngine } from './media-prefetch';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_BYTES = 5 * 1024 * 1024;
const TARGET_MAX_WIDTH = 1280;
const TARGET_MAX_HEIGHT = 720;

async function readProblem(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new Error(body?.detail || fallback);
}

export function validateImage(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('استخدم صورة JPG أو PNG أو WebP أو AVIF.');
  if (file.size > MAX_BYTES) throw new Error('حجم الصورة يجب ألا يتجاوز 5MB.');
}

export async function optimizeImageForUpload(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, TARGET_MAX_WIDTH / width, TARGET_MAX_HEIGHT / height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    if (scale === 1 && file.type === 'image/webp' && file.size <= 160 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/webp', 0.84);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function uploadQuizCover(quizId: string, file: File): Promise<MediaVariantsDto> {
  return uploadImage({ quizId, target: 'cover', file, isEssential: false });
}

export async function uploadQuestionImage(quizId: string, questionId: string, file: File): Promise<MediaVariantsDto> {
  return uploadImage({ quizId, questionId, target: 'question', file, isEssential: true });
}

async function uploadImage(input: { quizId: string; questionId?: string; target: 'cover' | 'question'; file: File; isEssential: boolean }): Promise<MediaVariantsDto> {
  const { quizId, questionId, target, file, isEssential } = input;
  validateImage(file);
  const optimizedFile = await optimizeImageForUpload(file);

  const signatureResponse = await fetch('/api/media/signature', {
    method: 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizId,
      questionId,
      target,
      byteSize: optimizedFile.size,
      mimeType: optimizedFile.type,
      isEssential
    })
  });
  if (!signatureResponse.ok) return readProblem(signatureResponse, 'تعذر تجهيز رفع الصورة.');
  const signature = await signatureResponse.json();

  const form = new FormData();
  form.append('file', optimizedFile);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('public_id', signature.publicId);

  const uploadResponse = await fetch(signature.uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  if (!uploadResponse.ok) return readProblem(uploadResponse, 'تعذر رفع الصورة إلى Cloudinary.');
  const uploaded = await uploadResponse.json();

  const completeResponse = await fetch('/api/media/complete', {
    method: 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizId,
      questionId,
      target,
      publicId: uploaded.public_id || signature.publicId,
      format: uploaded.format || 'webp',
      version: typeof uploaded.version === 'number' ? uploaded.version : undefined,
      width: uploaded.width || 1280,
      height: uploaded.height || 720,
      byteSize: uploaded.bytes || optimizedFile.size,
      isEssential
    })
  });
  if (!completeResponse.ok) return readProblem(completeResponse, 'رُفعت الصورة ولكن تعذر ربطها بالمسابقة.');
  const media = (await completeResponse.json()) as MediaVariantsDto;

  // Immediately warm-up Cloudinary edge transformations and local cache at upload time
  const warmItems = [media.hostUrl, media.mobileUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => ({
      url,
      questionId: questionId || quizId,
      isEssential,
      priority: 1
    }));
  if (warmItems.length > 0) {
    globalMediaPrefetchEngine.queueImages(warmItems);
  }

  return media;
}
