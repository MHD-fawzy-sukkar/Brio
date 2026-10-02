import { z } from 'zod';

export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
] as const;

export const MAX_MEDIA_BYTE_SIZE = 5 * 1024 * 1024; // 5MB limit

export const UploadSignatureRequestSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  target: z.enum(['question', 'cover']).default('question'),
  byteSize: z.number().min(1).max(MAX_MEDIA_BYTE_SIZE, 'Image byte size must not exceed 5MB'),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES, {
    errorMap: () => ({ message: 'Unsupported image mime type. Allowed: JPEG, PNG, WebP, AVIF' })
  }),
  isEssential: z.boolean().default(true)
}).refine((value) => value.target === 'cover' || Boolean(value.questionId), {
  message: 'questionId is required for question images', path: ['questionId']
});

export type UploadSignatureRequest = z.infer<typeof UploadSignatureRequestSchema>;

export const UploadCompleteRequestSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  target: z.enum(['question', 'cover']).default('question'),
  publicId: z.string().min(1),
  format: z.string().min(1),
  version: z.number().int().positive().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  byteSize: z.number().positive().max(MAX_MEDIA_BYTE_SIZE),
  isEssential: z.boolean().default(true)
}).refine((value) => value.target === 'cover' || Boolean(value.questionId), {
  message: 'questionId is required for question images', path: ['questionId']
});

export type UploadCompleteRequest = z.infer<typeof UploadCompleteRequestSchema>;

export interface MediaVariantsDto {
  mediaId: string;
  publicId: string;
  hostUrl: string;   // 1280x720 immutable variant
  mobileUrl: string; // 640x360 immutable variant
  isEssential: boolean;
  byteSize: number;
  width: number;
  height: number;
}
