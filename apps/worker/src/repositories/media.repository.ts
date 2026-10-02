import type { UploadSignatureRequest, UploadCompleteRequest, MediaVariantsDto } from '@brio/contracts';

export interface CloudinaryEnv {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  DEV_MEDIA_BYPASS?: string;
}

export async function generateCloudinarySignature(
  env: CloudinaryEnv,
  creatorId: string,
  request: UploadSignatureRequest
): Promise<{
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  mock: boolean;
}> {
  const timestamp = Math.floor(Date.now() / 1000);
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  // Stable IDs overwrite previous versions instead of accumulating paid orphan assets.
  const publicId = request.target === 'cover'
    ? `cover_${request.quizId}`
    : `question_${request.questionId!}`;
  const folder = `brio/${creatorId}/${request.quizId}`;

  if (env.DEV_MEDIA_BYPASS === 'true') {
    // Deterministic fixture fallback is opt-in and restricted to local development/tests.
    return {
      uploadUrl: '/api/media/mock-upload',
      apiKey: apiKey || 'mock_api_key',
      timestamp,
      signature: `mock_signature_${timestamp}`,
      folder,
      publicId,
      mock: true
    };
  }

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('خدمة رفع الصور غير مهيأة. يجب ضبط أسرار Cloudinary في بيئة الخادم.');
  }

  // Real Cloudinary SHA-1 Signature Calculation
  // Cloudinary string to sign: alphabetized parameters joined with &, plus API secret
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId,
    mock: false
  };
}

export async function saveMediaRecord(
  db: D1Database,
  creatorId: string,
  env: CloudinaryEnv,
  req: UploadCompleteRequest
): Promise<MediaVariantsDto> {
  const mediaId = crypto.randomUUID();
  const cloudName = env.CLOUDINARY_CLOUD_NAME;

  let hostUrl: string;
  let mobileUrl: string;

  if (env.DEV_MEDIA_BYPASS === 'true') {
    // Fixture URLs for local dev & testing
    hostUrl = `/fixtures/images/${req.publicId}_host.${req.format}`;
    mobileUrl = `/fixtures/images/${req.publicId}_mobile.${req.format}`;
  } else {
    if (!cloudName) throw new Error('خدمة رفع الصور غير مهيأة في بيئة الخادم.');
    // Eager immutable Cloudinary variant URLs with explicit width & crop constraints
    // host: max width 1280 (1280x720)
    // mobile: max width 640 (640x360)
    const version = req.version ? `/v${req.version}` : '';
    hostUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_1280,c_limit,f_auto,q_auto${version}/${req.publicId}.${req.format}`;
    mobileUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_640,c_limit,f_auto,q_auto${version}/${req.publicId}.${req.format}`;
  }

  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO media (
        id, creator_id, provider_public_id, rendition_json, version_hash, status,
        quiz_id, question_id, host_url, mobile_url, is_essential, byte_size, width, height, created_at
      )
      VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      mediaId,
      creatorId,
      req.publicId,
      JSON.stringify({ hostUrl, mobileUrl }),
      req.publicId,
      req.quizId,
      req.questionId || null,
      hostUrl,
      mobileUrl,
      req.isEssential ? 1 : 0,
      req.byteSize,
      req.width,
      req.height,
      now
    )
    .run();

  if (req.target === 'cover') {
    const updated = await db.prepare('UPDATE quizzes SET cover_image_url = ?, updated_at = ? WHERE id = ? AND creator_id = ?')
      .bind(hostUrl, now, req.quizId, creatorId).run();
    if (updated.meta.changes === 0) {
      await db.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();
      throw new Error('Quiz not found or unauthorized');
    }
    await db.prepare('DELETE FROM media WHERE quiz_id = ? AND question_id IS NULL AND id <> ?')
      .bind(req.quizId, mediaId).run();
  } else {
    const previous = await db.prepare('SELECT media_id FROM questions WHERE id = ? AND quiz_id = ?')
      .bind(req.questionId, req.quizId).first<{ media_id:string|null }>();
    if (!previous) {
      await db.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();
      throw new Error('Question not found in this quiz');
    }
    const updated = await db
      .prepare('UPDATE questions SET media_id = ?, essential = ? WHERE id = ? AND quiz_id = ?')
      .bind(mediaId, req.isEssential ? 1 : 0, req.questionId, req.quizId)
      .run();
    if (updated.meta.changes === 0) throw new Error('Question image could not be linked');
    if (previous.media_id && previous.media_id !== mediaId) {
      await db.prepare('DELETE FROM media WHERE id = ?').bind(previous.media_id).run();
    }
  }

  return {
    mediaId,
    publicId: req.publicId,
    hostUrl,
    mobileUrl,
    isEssential: req.isEssential,
    byteSize: req.byteSize,
    width: req.width,
    height: req.height
  };
}
