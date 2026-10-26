import { fitIdentityImage, visibleBounds } from './image-layout';

const normalizedImages = new WeakMap<File, Promise<File>>();
/** Reuse local normalization during save retries; no network work occurs here. */
export function normalizeIdentityImage(file: File): Promise<File> {
  const cached = normalizedImages.get(file);
  if (cached) return cached;
  const task = normalizeImage(file).catch(error => { normalizedImages.delete(file); throw error; });
  normalizedImages.set(file, task);
  return task;
}

/** All identity artwork uses the same transparent square, without stretching or removing backgrounds. */
async function normalizeImage(file: File): Promise<File> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('تعذّر قراءة الصورة. جرّب ملف PNG أو JPG آخر.'); }
  try {
    const sample = document.createElement('canvas');
    const ratio = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    sample.width = Math.max(1, Math.round(bitmap.width * ratio));
    sample.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, sample.width, sample.height);
    const bounds = visibleBounds(context.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height);
    if (!bounds) throw new Error('الصورة شفافة بالكامل. اختر صورة تحتوي رسماً ظاهراً.');
    const sx = bitmap.width / sample.width, sy = bitmap.height / sample.height;
    const crop = { x: bounds.x * sx, y: bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy };
    const target = fitIdentityImage(crop.width, crop.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    const output = canvas.getContext('2d');
    if (!output) return file;
    output.imageSmoothingQuality = 'high';
    output.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, target.x, target.y, target.width, target.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) throw new Error('تعذّر تجهيز الصورة للرفع. حاول مجدداً.');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type });
  } finally { bitmap.close(); }
}
