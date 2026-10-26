import { Hono } from 'hono';
import type { Env } from './env';
import { rfc7807Error } from './http/problem';
import { identityRoutes } from './routes/identities';
import systemRoutes from './routes/system';
import quizPublicationRoutes from './routes/quiz-publication';
import authRoutes from './routes/auth';
import quizRoutes from './routes/quizzes';
import questionRoutes from './routes/questions';
import mediaRoutes from './routes/media';
import roomManagementRoutes from './routes/room-management';
import roomPlayerRoutes from './routes/room-players';
import roomReadRoutes from './routes/room-reads';
import roomSocketRoutes from './routes/room-sockets';

export const app = new Hono<{ Bindings: Env }>();
app.route('/api', identityRoutes);
app.route('/', systemRoutes);
app.route('/', quizPublicationRoutes);
app.route('/', authRoutes);
app.route('/', quizRoutes);
app.route('/', questionRoutes);
app.route('/', mediaRoutes);
app.route('/', roomManagementRoutes);
app.route('/', roomPlayerRoutes);
app.route('/', roomReadRoutes);
app.route('/', roomSocketRoutes);
app.all('/api/*', (c) => {
  return rfc7807Error(c, 404, 'not_found', `API endpoint '${c.req.path}' not found`);
});
app.all('/ws/*', (c) => {
  return rfc7807Error(c, 404, 'not_found', `WebSocket endpoint '${c.req.path}' not found`);
});
