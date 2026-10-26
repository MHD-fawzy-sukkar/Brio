import type { IdentityUploadComplete } from '@brio/contracts';
import type { CloudinaryEnv } from '../repositories/media.repository';
import { IdentityError } from '../http/problem';

async function sha1(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function signIdentityUpload(env: CloudinaryEnv, creatorId: string) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new IdentityError('خدمة رفع الصور غير مهيأة في بيئة الخادم.', 409);
  }
  const assetId = crypto.randomUUID();
  // New IDs per upload: changing an identity must never overwrite a running room's artwork.
  const params = {
    allowed_formats: 'jpg,png,webp,avif',
    overwrite: 'false',
    public_id: `brio/${creatorId}/identities/${assetId}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const payload = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return {
    assetId,
    params,
    signature: await sha1(payload + env.CLOUDINARY_API_SECRET),
    apiKey: env.CLOUDINARY_API_KEY,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

export async function completeIdentityUpload(
  db: D1Database,
  env: CloudinaryEnv,
  creatorId: string,
  input: IdentityUploadComplete,
) {
  if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_CLOUD_NAME)
    throw new IdentityError('خدمة رفع الصور غير مهيأة.', 409);
  const expectedId = `brio/${creatorId}/identities/${input.assetId}`;
  const expectedSignature = await sha1(
    `public_id=${input.publicId}&version=${input.version}${env.CLOUDINARY_API_SECRET}`,
  );
  if (input.publicId !== expectedId || input.signature !== expectedSignature)
    throw new IdentityError('تعذر التحقق من ملكية الصورة المرفوعة.');
  // Serve only a bounded raster transformation, preserving transparency and aspect ratio.
  const sourceUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_pad,w_640,h_640,b_transparent,f_webp,q_auto/v${input.version}/${input.publicId}.webp`;
  await db
    .prepare(
      'INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(input.assetId, creatorId, sourceUrl, new Date().toISOString())
    .run();
  return { mediaId: input.assetId, src: sourceUrl };
}
