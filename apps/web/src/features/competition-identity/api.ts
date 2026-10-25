import type { IdentityRecordDto, SaveIdentityRequest, ThemeSummaryDto } from '@brio/contracts';
import { requestJson, jsonBody } from '../../services/http-json';
import { validateImage } from '../../services/media-upload';
import { normalizeIdentityImage } from './normalize-image';

export const getQuizIdentity = (quizId: string, signal?: AbortSignal) => requestJson<{ record: IdentityRecordDto | null }>(`/api/quizzes/${encodeURIComponent(quizId)}/identity`, { signal });
export const saveQuizIdentity = (quizId: string, input: SaveIdentityRequest) => requestJson<IdentityRecordDto>(
  `/api/quizzes/${encodeURIComponent(quizId)}/identity`, jsonBody('POST', input));
export const assignIdentity = (quizId: string, identityId: string | null) => requestJson(`/api/quizzes/${encodeURIComponent(quizId)}/identity`, jsonBody('PUT', { identityId }));
export const getThemes = (signal?: AbortSignal) => requestJson<ThemeSummaryDto[]>('/api/themes', { signal });
export const setThemeVisibility = (id: string, visibility: 'private' | 'public', confirmed = false) => requestJson(`/api/themes/${encodeURIComponent(id)}/visibility`, jsonBody('PATCH', { visibility, confirmed }));

export type IdentityAsset = { mediaId: string; src: string };
export async function uploadIdentityImage(file: File, signal?: AbortSignal): Promise<IdentityAsset> {
  validateImage(file);
  const optimized = await normalizeIdentityImage(file);
  const signed = await requestJson<{ assetId: string; uploadUrl: string; apiKey: string; signature: string; params: Record<string, string> }>(
    '/api/identity-assets/signature', { ...jsonBody('POST', { byteSize: optimized.size, mimeType: optimized.type }), signal });
  if (!signed?.assetId || !signed.uploadUrl || !signed.apiKey || !signed.signature || !signed.params) {
    throw new Error('تعذّر تجهيز رفع الصورة. حدّث الصفحة وحاول مجدداً.');
  }
  const form = new FormData();
  form.append('file', optimized);
  form.append('api_key', signed.apiKey);
  form.append('signature', signed.signature);
  for (const [key, value] of Object.entries(signed.params)) form.append(key, value);
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(signed.uploadUrl, { method: 'POST', body: form, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error('تعذّر رفع الصورة. حاول مجدداً.');
  const result = await response.json().catch(() => null);
  if (!result?.public_id || !result.version || !result.signature) throw new Error('لم يكتمل رد خدمة الصور. أعد المحاولة.');
  return requestJson('/api/identity-assets/complete', { ...jsonBody('POST', {
    assetId: signed.assetId, publicId: result.public_id, version: result.version, signature: result.signature
  }), signal });
}
