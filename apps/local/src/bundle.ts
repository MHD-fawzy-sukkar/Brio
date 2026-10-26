import { createHash } from 'node:crypto';
import { z } from 'zod';
import { imageSize } from 'image-size';
import { AuthoringQuestionSchema, CompetitionIdentitySchema, mapIdentityImages } from '@brio/contracts';
import type { PublishedQuizSnapshot } from '@brio/game-core';

export const MAX_BUNDLE_BYTES = 48 * 1024 * 1024;
const question = AuthoringQuestionSchema.extend({
  id: z.string().min(1).max(100),
  options: z
    .array(
      z.object({ id: z.string().min(1).max(100), text: z.string().min(1).max(200), isCorrect: z.boolean() }),
    )
    .max(30),
  acceptedAlternatives: z.array(z.string().min(1).max(200)).max(100),
}).superRefine((q, ctx) => {
  const correct = q.options.filter((o) => o.isCorrect).length;
  const valid =
    q.type === 'ShortAnswer'
      ? q.acceptedAlternatives.length > 0 && q.options.length === 0
      : q.options.length >= 2 &&
        (q.type === 'Poll' ? correct === 0 : correct === 1) &&
        (q.type !== 'TrueFalse' || q.options.length === 2);
  if (!valid || new Set(q.options.map((o) => o.id)).size !== q.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid question answers' });
  }
});

export const BundleSchema = z.object({
  format: z.literal('brio-lan'),
  version: z.literal(1),
  quiz: z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(120),
    revision: z.number().int().positive(),
    identity: CompetitionIdentitySchema.optional(),
    questions: z.array(question).min(1).max(500),
  }),
  media: z
    .array(
      z.object({
        sourceUrl: z.string().max(2048),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
        base64: z
          .string()
          .max(700000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      }),
    )
    .max(520),
});

export function validateBundle(input: unknown) {
  const bundle = BundleSchema.parse(input);
  if (JSON.stringify(bundle.quiz).length > 2 * 1024 * 1024) throw new Error('Quiz exceeds 2 MiB');
  if (new Set(bundle.quiz.questions.map((q) => q.id)).size !== bundle.quiz.questions.length)
    throw new Error('Duplicate questions');
  const media = bundle.media.map((item) => {
    const bytes = Buffer.from(item.base64, 'base64');
    if (
      bytes.length > 500 * 1024 ||
      !bytes.length ||
      createHash('sha256').update(bytes).digest('hex') !== item.sha256
    ) {
      throw new Error('Invalid image checksum or size');
    }
    // Reject HTML/SVG masquerading as raster content.
    const valid =
      item.contentType === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : item.contentType === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : item.contentType === 'image/webp'
            ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
            : bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32));
    if (!valid) throw new Error('Invalid raster image');
    const dimensions = imageSize(bytes);
    if (
      !dimensions.width ||
      !dimensions.height ||
      dimensions.width > 2560 ||
      dimensions.height > 2560 ||
      dimensions.width * dimensions.height > 4_000_000
    )
      throw new Error('Image dimensions exceed mobile budget');
    return { ...item, bytes };
  });
  if (new Set(media.map((m) => m.sourceUrl)).size !== media.length) throw new Error('Duplicate media URLs');
  const urls = new Map(media.map((m) => [m.sourceUrl, `/media/${m.sha256}`]));
  const quiz: PublishedQuizSnapshot = {
    ...bundle.quiz,
    identity: bundle.quiz.identity
      ? mapIdentityImages(bundle.quiz.identity, (src) => {
          const local = urls.get(src);
          if (!local) throw new Error('Missing identity image');
          return local;
        })
      : undefined,
    questions: bundle.quiz.questions.map((q) => {
      if (q.essentialImage && !urls.has(q.essentialImage)) throw new Error('Missing quiz image');
      return { ...q, essentialImage: q.essentialImage ? urls.get(q.essentialImage)! : null };
    }),
  };
  return { quiz, media };
}
