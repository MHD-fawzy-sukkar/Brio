import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../app';
const expected = [
  ['GET', '/api/creator/stats'],
  ['GET', '/api/quizzes/:id/lan-export'],
  ['GET', '/api/health'],
  ['GET', '/api/auth/nonce'],
  ['POST', '/api/auth/google'],
  ['GET', '/api/auth/me'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/quizzes'],
  ['POST', '/api/quizzes'],
  ['GET', '/api/quizzes/:id'],
  ['PATCH', '/api/quizzes/:id'],
  ['DELETE', '/api/quizzes/:id'],
  ['POST', '/api/quizzes/:id/questions'],
  ['DELETE', '/api/quizzes/:id/questions/:questionId'],
  ['PUT', '/api/quizzes/:id/questions/:questionId'],
  ['PUT', '/api/quizzes/:id/question-order'],
  ['POST', '/api/quizzes/:id/publish'],
  ['POST', '/api/media/signature'],
  ['POST', '/api/media/complete'],
  ['POST', '/api/media/mock-upload'],
  ['POST', '/api/rooms'],
  ['DELETE', '/api/rooms/:roomId'],
  ['GET', '/api/rooms/by-code/:code'],
  ['GET', '/api/rooms/:roomId/identity'],
  ['GET', '/api/rooms/:roomId/session'],
  ['POST', '/api/rooms/:roomId/join'],
  ['POST', '/api/rooms/:roomId/leave'],
  ['GET', '/api/rooms/:roomId/snapshot'],
  ['GET', '/api/rooms/:roomId/media'],
  ['GET', '/api/rooms/:roomId/metrics'],
  ['ALL', '/ws/rooms/:roomId'],
  ['ALL', '/api/*'],
  ['ALL', '/ws/*'],
];
test('refactored route registry preserves every existing HTTP and WebSocket endpoint', () => {
  const registered = new Set(app.routes.map((route) => route.method + ' ' + route.path));
  for (const [method, path] of expected) assert.ok(registered.has(method + ' ' + path), method + ' ' + path);
});
