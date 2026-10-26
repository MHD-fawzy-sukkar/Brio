import { Hono } from 'hono';
import { getQuizForCreator, publishQuizVersion, getLatestQuizVersion } from '../repositories/quiz.repository';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/quizzes/:id/lan-export', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  const quizId = c.req.param('id');
  const owned = await getQuizForCreator(c.env.DB, quizId, creator.id);
  if (!owned) return rfc7807Error(c, 404, 'not_found', 'Quiz not found');
  const published = await getLatestQuizVersion(c.env.DB, quizId);
  if (!published) return rfc7807Error(c, 409, 'not_published', 'Publish the quiz first');
  c.header('Cache-Control', 'no-store');
  return c.json({ format: 'brio-lan', version: 1, quiz: JSON.parse(published.private_snapshot_json) });
});

app.post('/api/quizzes/:id/publish', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) {
    return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  }

  const quizId = c.req.param('id');

  try {
    const published = await publishQuizVersion(c.env.DB, quizId, creator.id);
    return c.json(published);
  } catch (err: any) {
    return rfc7807Error(c, 400, 'publish_failed', err.message);
  }
});

export default app;
