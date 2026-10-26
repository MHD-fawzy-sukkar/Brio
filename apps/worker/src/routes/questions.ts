import { Hono } from 'hono';
import { validateOrigin } from '../auth/session';
import {
  addQuestionToQuiz,
  updateQuestionInQuiz,
  deleteQuestionFromQuiz,
  reorderQuizQuestions,
} from '../repositories/quiz.repository';
import { AuthoringQuestionSchema } from '@brio/contracts';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.post('/api/quizzes/:id/questions', async (c) => {
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

  const parsed = AuthoringQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Validation failed for question data',
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const questionId = await addQuestionToQuiz(c.env.DB, quizId, creator.id, parsed.data);
    return c.json({ questionId }, 201);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

app.delete('/api/quizzes/:id/questions/:questionId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');
  const questionId = c.req.param('questionId');

  try {
    await deleteQuestionFromQuiz(c.env.DB, quizId, questionId, creator.id);
    return c.json({ status: 'question_deleted' });
  } catch (err: any) {
    return rfc7807Error(c, 404, 'not_found', err.message);
  }
});

app.put('/api/quizzes/:id/questions/:questionId', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }
  const parsed = AuthoringQuestionSchema.safeParse(body);
  if (!parsed.success)
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'Validation failed for question data',
      parsed.error.flatten().fieldErrors,
    );
  try {
    await updateQuestionInQuiz(
      c.env.DB,
      c.req.param('id'),
      c.req.param('questionId'),
      creator.id,
      parsed.data,
    );
    return c.json({ status: 'question_updated' });
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

app.put('/api/quizzes/:id/question-order', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  if (!validateOrigin(c.req.raw))
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin mutation denied');

  const quizId = c.req.param('id');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return rfc7807Error(c, 400, 'bad_request', 'Invalid JSON body');
  }

  if (
    !body ||
    !Array.isArray(body.questionIds) ||
    !body.questionIds.every((id: unknown) => typeof id === 'string')
  ) {
    return rfc7807Error(c, 400, 'validation_failed', 'أرسل قائمة معرّفات الأسئلة بالترتيب المطلوب.');
  }

  try {
    await reorderQuizQuestions(c.env.DB, quizId, creator.id, body.questionIds);
    return c.json({ status: 'reordered' });
  } catch (err: any) {
    return rfc7807Error(c, 400, 'business_rule_violation', err.message);
  }
});

export default app;
