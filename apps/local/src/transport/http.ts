import { isCompetitionAvatarAllowed } from '@brio/contracts';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { endQuiz } from '@brio/game-core';
import { MAX_BUNDLE_BYTES } from '../bundle';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LanRuntime } from '../runtime';
import { digest, cookie, playerCookie, joinSchema, mime, HttpError } from './protocol';
export function createLanHttpHandler(runtime: LanRuntime, getPort: () => number) {
  const {
    store,
    now,
    root,
    connections,
    timers,
    hostUpdateTimers,
    addresses,
    identity,
    getRoom,
    authorize,
    requireHost,
    snapshot,
    commit,
    reconcile,
    body,
    json,
    requestUrl,
  } = runtime;
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = requestUrl(req),
        path = url.pathname;
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (path === '/api/health') return json(res, 200, { status: 'ok', mode: 'lan' });
      if (path === '/api/local/login' && req.method === 'POST') {
        // Host authentication is bootstrapped only on this Windows machine, never on player devices.
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || ''))
          throw new HttpError(403, 'إدارة الجلسة متاحة من جهاز المقدّم فقط.');
        if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
          throw new HttpError(403, 'افتح لوحة المقدّم من اختصار التشغيل على هذا الجهاز.');
        res.setHeader(
          'Set-Cookie',
          `brio_lan_admin=${runtime.adminSession}; HttpOnly; SameSite=Strict; Path=/`,
        );
        return json(res, 200, { status: 'ok' });
      }
      if (path === '/api/auth/me') {
        requireHost(req);
        return json(res, 200, {
          creator: { id: 'local-host', displayName: 'المقدّم', email: '', createdAt: '' },
        });
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        requireHost(req);
        runtime.adminSession = randomBytes(32).toString('hex');
        res.setHeader('Set-Cookie', 'brio_lan_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        for (const c of connections) if (c.host) c.ws.close(1008, 'Logged out');
        return json(res, 200, { status: 'ok' });
      }
      if (path === '/api/local/info') {
        requireHost(req);
        const port = getPort();
        return json(res, 200, {
          mode: 'lan',
          joinOrigins: addresses.map((a) => `http://${a}:${port}`),
          quizzes: store.listQuizzes(),
          rooms: store.listRooms().map((r) => ({
            roomId: r.id,
            quizId: r.quiz.id,
            code: r.code,
            title: r.quiz.title,
            phase: r.state.phase,
          })),
        });
      }
      if (path === '/api/local/import' && req.method === 'POST') {
        requireHost(req);
        const input = await body(req, MAX_BUNDLE_BYTES);
        let result;
        try {
          result = store.importBundle(input);
        } catch {
          throw new HttpError(
            400,
            'ملف المسابقة غير مكتمل أو غير متوافق. أعد تنزيله من صفحة تعديل المسابقة وحاول مجدداً.',
          );
        }
        return json(res, 201, result);
      }
      const localQuiz = path.match(/^\/api\/local\/quizzes\/([^/]+)$/);
      if (localQuiz && req.method === 'DELETE') {
        requireHost(req);
        const id = decodeURIComponent(localQuiz[1]);
        if (store.listRooms().some((r) => r.quiz.id === id && r.state.phase !== 'FINISHED'))
          throw new HttpError(409, 'أنهِ الغرفة المرتبطة بهذه المسابقة قبل حذفها.');
        if (!store.deleteQuiz(id)) throw new HttpError(404, 'المسابقة غير موجودة على هذا الجهاز.');
        return json(res, 200, { status: 'deleted' });
      }
      const localRoom = path.match(/^\/api\/local\/rooms\/([a-f0-9-]{36})$/);
      if (localRoom && req.method === 'DELETE') {
        requireHost(req);
        const room = getRoom(localRoom[1]);
        if (room.state.phase !== 'FINISHED') throw new HttpError(409, 'يمكن حذف نتائج الجلسات المنتهية فقط.');
        store.deleteRoom(room.id);
        clearTimeout(timers.get(room.id));
        timers.delete(room.id);
        clearTimeout(hostUpdateTimers.get(room.id));
        hostUpdateTimers.delete(room.id);
        for (const c of connections) if (c.roomId === room.id) c.ws.close(1000, 'Session removed');
        return json(res, 200, { status: 'deleted' });
      }
      if (path === '/api/rooms' && req.method === 'POST') {
        requireHost(req);
        const data = z.object({ quizId: z.string().max(100) }).parse(await body(req));
        if (store.listRooms().some((r) => r.state.phase !== 'FINISHED'))
          throw new HttpError(409, 'أنهِ الغرفة الحالية قبل فتح غرفة جديدة.');
        const room = store.createRoom(data.quizId);
        return json(res, 201, { roomId: room.id, code: room.code });
      }
      const byCode = path.match(/^\/api\/rooms\/by-code\/(\d{6})$/);
      if (byCode) {
        const room = store.listRooms().find((r) => r.code === byCode[1] && r.state.phase !== 'FINISHED');
        if (!room) throw new HttpError(404, 'الغرفة غير موجودة أو انتهت.');
        return json(res, 200, { roomId: room.id, code: room.code, status: 'active' });
      }
      const route = path.match(
        /^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|leave|snapshot|media|results|identity))?$/,
      );
      if (route) {
        let room = reconcile(route[1]);
        const action = route[2];
        if (action === 'identity' && req.method === 'GET') {
          if (room.state.phase === 'FINISHED') throw new HttpError(404, 'انتهت اللعبة.');
          return json(res, 200, { identity: room.quiz.identity ?? null });
        }
        if (action === 'join' && req.method === 'POST') {
          if (room.state.phase === 'FINISHED') throw new HttpError(409, 'انتهت اللعبة.');
          const data = joinSchema.parse(await body(req));
          // Re-read after asynchronous body input so concurrent joins cannot overwrite each other.
          room = reconcile(route[1]);
          if (room.state.phase === 'FINISHED') throw new HttpError(409, 'انتهت اللعبة.');
          let playerId = identity(req, room),
            token = cookie(req, playerCookie(room.id));
          if (!playerId) {
            if (!isCompetitionAvatarAllowed(room.quiz.identity, data.avatarId))
              throw new HttpError(400, 'اختر صورة متاحة ضمن هذه المسابقة.');
            if (room.state.players.size >= 200) throw new HttpError(409, 'الغرفة ممتلئة.');
            playerId = `p_${randomUUID()}`;
            token = randomBytes(32).toString('hex');
            room.sessions.set(digest(token), playerId);
            room.state.players.set(playerId, {
              id: playerId,
              nickname: data.nickname,
              avatarId: data.avatarId,
              score: 0,
              joinedAt: now(),
              connectionGeneration: 0,
            });
            room.state.stateVersion++;
            commit(room);
          }
          const p = room.state.players.get(playerId)!;
          res.setHeader(
            'Set-Cookie',
            `${playerCookie(room.id)}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400`,
          );
          return json(res, 201, {
            roomId: room.id,
            playerId,
            nickname: p.nickname,
            avatarId: p.avatarId,
            sessionToken: 'cookie',
          });
        }
        const auth = authorize(req, room);
        if (req.method === 'DELETE' && !action) {
          requireHost(req);
          endQuiz(room.state);
          commit(room);
          return json(res, 200, { status: 'finished' });
        }
        if (action === 'media')
          return json(
            res,
            200,
            room.quiz.questions
              .map((q, i) => ({ mediaId: q.id, url: q.essentialImage, questionIndex: i, isEssential: true }))
              .filter((m) => m.url),
          );
        if (action === 'snapshot' || action === 'results')
          return json(res, 200, snapshot(room, auth).payload);
        if (action === 'leave' && req.method === 'POST') {
          if (!auth.playerId || room.state.phase !== 'LOBBY')
            throw new HttpError(409, 'لا يمكن مغادرة اللوبي الآن.');
          room.state.players.delete(auth.playerId);
          for (const [hash, id] of room.sessions) if (id === auth.playerId) room.sessions.delete(hash);
          room.state.stateVersion++;
          commit(room);
          for (const c of connections)
            if (c.roomId === room.id && c.playerId === auth.playerId) c.ws.close(1000);
          return json(res, 200, { status: 'left' });
        }
        throw new HttpError(405, 'العملية غير مدعومة.');
      }
      const image = path.match(/^\/media\/([a-f0-9]{64})$/);
      if (image) {
        const row = store.db.prepare('SELECT mime,bytes FROM media WHERE hash=?').get(image[1]);
        if (!row) throw new HttpError(404, 'الصورة غير موجودة.');
        res.writeHead(200, {
          'Content-Type': row.mime as string,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(row.bytes);
      }
      if (path.startsWith('/api/') || path.startsWith('/ws/')) throw new HttpError(404, 'المسار غير موجود.');
      if (!['GET', 'HEAD'].includes(req.method || '')) throw new HttpError(405, 'Method not allowed');
      if (/^\/(login|dashboard|builder|questions|quizzes)(\/|$)/.test(path)) {
        res.writeHead(302, { Location: '/local/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      const decoded = decodeURIComponent(path);
      const directoryIndex = resolve(root, `.${decoded}`, 'index.html');
      if (
        !decoded.endsWith('/') &&
        directoryIndex.startsWith(root + sep) &&
        existsSync(directoryIndex) &&
        statSync(directoryIndex).isFile()
      ) {
        res.writeHead(308, { Location: `${path}/${url.search}`, 'Cache-Control': 'no-store' });
        return res.end();
      }
      const file = resolve(root, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile())
        throw new HttpError(404, 'الصفحة غير موجودة.');
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws://${url.host}; frame-src 'none'`,
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 500;
      if (status === 500) console.error('LAN request failed', error);
      if (!res.headersSent)
        json(res, status, {
          status,
          detail:
            error instanceof HttpError
              ? error.message
              : status === 400
                ? 'محتوى غير صالح.'
                : 'تعذّرت العملية. تحقق من الملف وسجل التشغيل.',
        });
    }
  };
}
