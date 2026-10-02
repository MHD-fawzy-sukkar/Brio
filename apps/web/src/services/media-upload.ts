import type { MediaVariantsDto } from '@brio/contracts';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_BYTES = 5 * 1024 * 1024;

async function readProblem(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new Error(body?.detail || fallback);
}

export function validateImage(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('استخدم صورة JPG أو PNG أو WebP أو AVIF.');
  if (file.size > MAX_BYTES) throw new Error('حجم الصورة يجب ألا يتجاوز 5MB.');
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
  const signatureResponse = await fetch('/api/media/signature', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId, questionId, target, byteSize: file.size, mimeType: file.type, isEssential })
  });
  if (!signatureResponse.ok) return readProblem(signatureResponse, 'تعذر تجهيز رفع الصورة.');
  const signature = await signatureResponse.json();

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('public_id', signature.publicId);

  const uploadResponse = await fetch(signature.uploadUrl, { method: 'POST', body: form });
  if (!uploadResponse.ok) return readProblem(uploadResponse, 'تعذر رفع الصورة إلى Cloudinary.');
  const uploaded = await uploadResponse.json();

  const completeResponse = await fetch('/api/media/complete', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizId,
      questionId,
      target,
      publicId: uploaded.public_id || signature.publicId,
      format: uploaded.format || 'webp',
      width: uploaded.width || 1280,
      height: uploaded.height || 720,
      byteSize: uploaded.bytes || file.size,
      isEssential
    })
  });
  if (!completeResponse.ok) return readProblem(completeResponse, 'رُفعت الصورة ولكن تعذر ربطها بالمسابقة.');
  return completeResponse.json();
}
