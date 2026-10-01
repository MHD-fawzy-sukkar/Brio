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

  const publicId = `img_${request.questionId.substring(0, 8)}_${timestamp}`;
  const folder = `brio/${creatorId}/${request.quizId}`;

  if (!cloudName || !apiKey || !apiSecret || env.DEV_MEDIA_BYPASS === 'true') {
    // Deterministic Mock / Fixture fallback for tests and development without live Cloudinary keys
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
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'brio-demo';

  let hostUrl: string;
  let mobileUrl: string;

  if (env.DEV_MEDIA_BYPASS === 'true' || !env.CLOUDINARY_CLOUD_NAME) {
    // Fixture URLs for local dev & testing
    hostUrl = `/fixtures/images/${req.publicId}_host.${req.format}`;
    mobileUrl = `/fixtures/images/${req.publicId}_mobile.${req.format}`;
  } else {
    // Eager immutable Cloudinary variant URLs with explicit width & crop constraints
    // host: max width 1280 (1280x720)
    // mobile: max width 640 (640x360)
    hostUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_1280,c_limit,f_auto,q_auto/${req.publicId}.${req.format}`;
    mobileUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_640,c_limit,f_auto,q_auto/${req.publicId}.${req.format}`;
  }

  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO media (id, creator_id, quiz_id, question_id, host_url, mobile_url, is_essential, byte_size, width, height, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      mediaId,
      creatorId,
      req.quizId,
      req.questionId,
      hostUrl,
      mobileUrl,
      req.isEssential ? 1 : 0,
      req.byteSize,
      req.width,
      req.height,
      now
    )
    .run();

  // Attach media_id to question record in questions table
  await db
    .prepare('UPDATE questions SET media_id = ?, essential = ? WHERE id = ? AND quiz_id = ?')
    .bind(mediaId, req.isEssential ? 1 : 0, req.questionId, req.quizId)
    .run();

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
