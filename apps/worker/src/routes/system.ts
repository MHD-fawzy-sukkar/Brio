import { Hono } from 'hono';
import { getAuthCreator } from '../http/creator';
import { rfc7807Error } from '../http/problem';
import {
  creatorParticipationStats,
  readCreatorParticipationStats,
} from '../repositories/creator-stats.repository';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/creator/stats', async (c) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  c.header('Cache-Control', 'no-store');
  try {
    const snapshot = await readCreatorParticipationStats(c.env.DB, creator.id);
    if (snapshot.pending)
      c.executionCtx.waitUntil(
        creatorParticipationStats(c.env, creator.id).catch(() => {
          console.warn('Participation refresh deferred');
        }),
      );
    return c.json(snapshot);
  } catch {
    return rfc7807Error(
      c,
      503,
      'participation_stats_unavailable',
      'تعذّر تحميل إجمالي المشاركات الآن. حاول مجدداً.',
    );
  }
});

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default app;
