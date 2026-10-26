import { Hono } from 'hono';
import { validateOrigin } from '../auth/session';
import {
  listQuizzesForCreator,
  getQuizForCreator,
  createQuizForCreator,
  updateQuizDetails,
  deleteQuizForCreator,
} from '../repositories/quiz.repository';
import { SaveQuizRequestSchema } from '@brio/contracts';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/quizzes', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizzes = await listQuizzesForCreator(c.env.DB, creator.id);
  return c.json(quizzes);
});

app.post('/api/quizzes', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  if (!validateOrigin(c.req.raw)) {
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin mutation denied');
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON payload');
  }

  const parsed = SaveQuizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Validation failed for quiz creation',
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const quiz = await createQuizForCreator(
      c.env.DB,
      creator.id,
      parsed.data.title,
      parsed.data.coverImageUrl,
      parsed.data.questions,
      parsed.data.identity,
      parsed.data.identityId,
    );
    return c.json(quiz, 201);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

app.get('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  const quiz = await getQuizForCreator(c.env.DB, quizId, creator.id);
  if (!quiz) {
    return rfc7807Error(c, 404, 'not_found', `Quiz '${quizId}' not found or access denied`);
  }

  return c.json(quiz);
});

app.patch('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  const parsed = SaveQuizRequestSchema.pick({ title: true, coverImageUrl: true }).safeParse(body);
  if (!parsed.success)
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Valid title and optional cover image are required',
      parsed.error.flatten().fieldErrors,
    );

  try {
    await updateQuizDetails(c.env.DB, quizId, creator.id, parsed.data.title, parsed.data.coverImageUrl);
    return c.json({ status: 'updated' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

app.delete('/api/quizzes/:id', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  try {
    await deleteQuizForCreator(c.env.DB, quizId, creator.id);
    return c.json({ status: 'deleted' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

export default app;
