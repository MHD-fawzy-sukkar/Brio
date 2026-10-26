import { Hono } from 'hono';
import { getQuizForCreator } from '../repositories/quiz.repository';
import { UploadSignatureRequestSchema, UploadCompleteRequestSchema } from '@brio/contracts';
import { generateCloudinarySignature, saveMediaRecord } from '../repositories/media.repository';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.post('/api/media/signature', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = UploadSignatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Media upload signature validation failed',
      parsed.error.flatten().fieldErrors,
    );
  }

  const quiz = await getQuizForCreator(c.env.DB, parsed.data.quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', 'Quiz not found or unauthorized');
  }
  if (
    parsed.data.target === 'question' &&
    !quiz.questions.some((question) => question.id === parsed.data.questionId)
  ) {
    return rfc7807Error(c, 404, 'not_found', 'Question not found in this quiz');
  }

  try {
    const sig = await generateCloudinarySignature(c.env as any, creator.id, parsed.data);
    return c.json(sig);
  } catch (err: any) {
    return rfc7807Error(c, 500, 'signature_generation_failed', err.message);
  }
});

app.post('/api/media/complete', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = UploadCompleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Media completion validation failed',
      parsed.error.flatten().fieldErrors,
    );
  }

  const quiz = await getQuizForCreator(c.env.DB, parsed.data.quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', 'Quiz not found or unauthorized');
  }
  if (
    parsed.data.target === 'question' &&
    !quiz.questions.some((question) => question.id === parsed.data.questionId)
  ) {
    return rfc7807Error(c, 404, 'not_found', 'Question not found in this quiz');
  }

  try {
    const media = await saveMediaRecord(c.env.DB, creator.id, c.env as any, parsed.data);
    return c.json(media, 201);
  } catch (err: any) {
    return rfc7807Error(c, 500, 'media_save_failed', err.message);
  }
});

app.post('/api/media/mock-upload', async (c) => {
  if (c.env.DEV_MEDIA_BYPASS !== 'true') {
    return rfc7807Error(c, 404, 'not_found', 'Route not found');
  }
  return c.json({
    public_id: 'mock_uploaded_img',
    format: 'webp',
    width: 1280,
    height: 720,
    bytes: 154000,
  });
});

export default app;
