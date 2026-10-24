import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { startQuiz, endQuiz, reconcileDeadlines, processAnswerSubmission, requestPause, requestResume,
  handleOverdueRecovery, toPublicHostSnapshot, toPublicPlayerSnapshot } from '@brio/game-core';
import { LocalStore, type Room } from './store';
import { MAX_BUNDLE_BYTES } from './bundle';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookie = (req: IncomingMessage, name: string) => (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(`${name}=`))?.slice(name.length + 1) || '';
const playerCookie = (id: string) => `brio_lan_${id}`;
const joinSchema = z.object({ nickname: z.string().trim().min(2).max(20), avatarId: z.string().regex(/^(?:bolt-avatar-(?:0[1-9]|1[0-5])|avatar_(?:[1-9]|1[0-5]))$/).default('avatar_1') });
const answerSchema = z.object({ roundId: z.string().max(160), submissionId: z.string().min(1).max(100), optionId: z.string().max(100).optional(), textAnswer: z.string().max(200).optional() });
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
type Connection = { ws: WebSocket; roomId: string; playerId?: string; host: boolean; recent: number[] };

export function createLanServer(options: { database: string; webRoot: string; port?: number; bind?: string; now?: () => number }) {
  const store = new LocalStore(options.database);
  const now = options.now || Date.now;
  let adminSession = randomBytes(32).toString('hex');
  const root = resolve(options.webRoot);
  const connections = new Set<Connection>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const hostUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const addresses = Object.values(networkInterfaces()).flatMap(items => items || []).filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address);
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...addresses]);
  const isHost = (req: IncomingMessage) => digest(cookie(req, 'brio_lan_admin')) === digest(adminSession);
  const identity = (req: IncomingMessage, room: Room) => room.sessions.get(digest(cookie(req, playerCookie(room.id))));
  const getRoom = (id: string) => { const room = store.load(id); if (!room) throw new HttpError(404, 'الغرفة غير موجودة.'); return room; };
  function authorize(req: IncomingMessage, room: Room) {
    const host = isHost(req), playerId = identity(req, room);
    if (!host && !playerId) throw new HttpError(401, 'انضم إلى الغرفة أولاً.');
    return { host, playerId };
  }
  function requireHost(req: IncomingMessage) { if (!isHost(req)) throw new HttpError(401, 'افتح لوحة المقدّم من جهاز التشغيل أولاً.'); }
  function send(ws: WebSocket, data: unknown) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 256 * 1024) return ws.close(1013, 'Reconnect');
    ws.send(JSON.stringify(data));
  }
  function snapshot(room: Room, c: Pick<Connection, 'host' | 'playerId'>, t0?: number) {
    const payload = c.host ? toPublicHostSnapshot(room.state, room.quiz) : toPublicPlayerSnapshot(room.state, c.playerId!, room.quiz);
    // Personal receipt restores accepted UI after refresh without revealing correctness.
    const answer = room.state.activeRound && c.playerId ? room.state.answers.get(`${room.state.activeRound.roundId}:${c.playerId}`) : null;
    return { v: 1, type: 'room.snapshot', stateVersion: room.state.stateVersion, serverNow: now(), t0,
      payload: { ...payload, ...(answer ? { ownReceipt: { submissionId: answer.submissionId, acceptedAt: answer.receivedAt, optionId: answer.optionId, textAnswer: answer.textAnswer } } : {}) } };
  }
  function broadcast(room: Room) { for (const c of connections) if (c.roomId === room.id) send(c.ws, snapshot(room, c)); }
  function scheduleHostCount(roomId: string) {
    if (hostUpdateTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      hostUpdateTimers.delete(roomId);
      const room = store.load(roomId);
      if (room) for (const c of connections) if (c.roomId === roomId && c.host) send(c.ws, snapshot(room, c));
    }, 1000);
    timer.unref(); hostUpdateTimers.set(roomId, timer);
  }
  function schedule(room: Room) {
    clearTimeout(timers.get(room.id)); timers.delete(room.id);
    const r = room.state.activeRound;
    if (!r) return;
    const due = room.state.phase === 'STATS' ? r.statsEndsAt : room.state.phase === 'LEADERBOARD' ? r.rankingEndsAt
      : ['COUNTDOWN', 'QUESTION'].includes(room.state.phase) ? r.endsAt : 0;
    if (!due) return;
    const tick = () => {
      try { reconcile(room.id); } catch (error) {
        console.error('LAN deadline persistence failed', error);
        const retry = setTimeout(tick, 1000);
        retry.unref(); timers.set(room.id, retry);
      }
    };
    const timer = setTimeout(tick, Math.max(1, due - now()));
    timer.unref(); timers.set(room.id, timer);
  }
  function commit(room: Room) {
    // Synchronous SQLite statement commits before any broadcast/ACK; discarded room objects never become authority.
    store.save(room); schedule(room); broadcast(room);
  }
  function reconcile(id: string) {
    const room = getRoom(id);
    const effects = reconcileDeadlines(room.state, room.quiz, now());
    if (effects.length) commit(room); else schedule(room);
    return room;
  }
  async function body(req: IncomingMessage, limit = 8192): Promise<any> {
    const chunks: Buffer[] = []; let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) throw new HttpError(413, 'حجم الملف أكبر من الحد المسموح.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'تعذّر قراءة الملف. اختر ملف المسابقة الذي نزّلته من مسابقاتك.'); }
  }
  function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  function requestUrl(req: IncomingMessage) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!allowedHosts.has(url.hostname)) throw new HttpError(403, 'عنوان المضيف غير مسموح.');
    if (req.headers.origin && req.headers.origin !== url.origin) throw new HttpError(403, 'طلب من مصدر غير مسموح.');
    if (!['GET', 'HEAD'].includes(req.method || '') && !req.headers.origin) throw new HttpError(403, 'Origin required');
    return url;
  }
  const server = createServer(async (req, res) => {
    try {
      const url = requestUrl(req), path = url.pathname;
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (path === '/api/health') return json(res, 200, { status: 'ok', mode: 'lan' });
      if (path === '/api/local/login' && req.method === 'POST') {
        // Host authentication is bootstrapped only on this Windows machine, never on player devices.
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) throw new HttpError(403, 'إدارة الجلسة متاحة من جهاز المقدّم فقط.');
        if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new HttpError(403, 'افتح لوحة المقدّم من اختصار التشغيل على هذا الجهاز.');
        res.setHeader('Set-Cookie', `brio_lan_admin=${adminSession}; HttpOnly; SameSite=Strict; Path=/`);
        return json(res, 200, { status: 'ok' });
      }
      if (path === '/api/auth/me') {
        requireHost(req);
        return json(res, 200, { creator: { id: 'local-host', displayName: 'المقدّم', email: '', createdAt: '' } });
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        requireHost(req);
        adminSession = randomBytes(32).toString('hex');
        res.setHeader('Set-Cookie', 'brio_lan_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        for (const c of connections) if (c.host) c.ws.close(1008, 'Logged out');
        return json(res, 200, { status: 'ok' });
      }
      if (path === '/api/local/info') {
        requireHost(req);
        const port = (server.address() as { port: number }).port;
        return json(res, 200, { mode: 'lan', joinOrigins: addresses.map(a => `http://${a}:${port}`), quizzes: store.listQuizzes(),
          rooms: store.listRooms().map(r => ({ roomId: r.id, quizId: r.quiz.id, code: r.code, title: r.quiz.title, phase: r.state.phase })) });
      }
      if (path === '/api/local/import' && req.method === 'POST') {
        requireHost(req);
        const input = await body(req, MAX_BUNDLE_BYTES);
        let result;
        try { result = store.importBundle(input); }
        catch { throw new HttpError(400, 'ملف المسابقة غير مكتمل أو غير متوافق. أعد تنزيله من صفحة تعديل المسابقة وحاول مجدداً.'); }
        return json(res, 201, result);
      }
      const localQuiz = path.match(/^\/api\/local\/quizzes\/([^/]+)$/);
      if (localQuiz && req.method === 'DELETE') {
        requireHost(req);
        const id = decodeURIComponent(localQuiz[1]);
        if (store.listRooms().some(r => r.quiz.id === id && r.state.phase !== 'FINISHED')) throw new HttpError(409, 'أنهِ الغرفة المرتبطة بهذه المسابقة قبل حذفها.');
        if (!store.deleteQuiz(id)) throw new HttpError(404, 'المسابقة غير موجودة على هذا الجهاز.');
        return json(res, 200, { status: 'deleted' });
      }
      const localRoom = path.match(/^\/api\/local\/rooms\/([a-f0-9-]{36})$/);
      if (localRoom && req.method === 'DELETE') {
        requireHost(req);
        const room = getRoom(localRoom[1]);
        if (room.state.phase !== 'FINISHED') throw new HttpError(409, 'يمكن حذف نتائج الجلسات المنتهية فقط.');
        store.deleteRoom(room.id);
        clearTimeout(timers.get(room.id)); timers.delete(room.id);
        clearTimeout(hostUpdateTimers.get(room.id)); hostUpdateTimers.delete(room.id);
        for (const c of connections) if (c.roomId === room.id) c.ws.close(1000, 'Session removed');
        return json(res, 200, { status: 'deleted' });
      }
      if (path === '/api/rooms' && req.method === 'POST') {
        requireHost(req);
        const data = z.object({ quizId: z.string().max(100) }).parse(await body(req));
        if (store.listRooms().some(r => r.state.phase !== 'FINISHED')) throw new HttpError(409, 'أنهِ الغرفة الحالية قبل فتح غرفة جديدة.');
        const room = store.createRoom(data.quizId);
        return json(res, 201, { roomId: room.id, code: room.code });
      }
      const byCode = path.match(/^\/api\/rooms\/by-code\/(\d{6})$/);
      if (byCode) {
        const room = store.listRooms().find(r => r.code === byCode[1] && r.state.phase !== 'FINISHED');
        if (!room) throw new HttpError(404, 'الغرفة غير موجودة أو انتهت.');
        return json(res, 200, { roomId: room.id, code: room.code, status: 'active' });
      }
      const route = path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|leave|snapshot|media|results))?$/);
      if (route) {
        let room = reconcile(route[1]);
        const action = route[2];
        if (action === 'join' && req.method === 'POST') {
          if (room.state.phase === 'FINISHED') throw new HttpError(409, 'انتهت اللعبة.');
          const data = joinSchema.parse(await body(req));
          // Re-read after asynchronous body input so concurrent joins cannot overwrite each other.
          room = reconcile(route[1]);
          if (room.state.phase === 'FINISHED') throw new HttpError(409, 'انتهت اللعبة.');
          let playerId = identity(req, room), token = cookie(req, playerCookie(room.id));
          if (!playerId) {
            if (room.state.players.size >= 200) throw new HttpError(409, 'الغرفة ممتلئة.');
            playerId = `p_${randomUUID()}`; token = randomBytes(32).toString('hex');
            room.sessions.set(digest(token), playerId);
            room.state.players.set(playerId, { id: playerId, nickname: data.nickname, avatarId: data.avatarId, score: 0, joinedAt: now(), connectionGeneration: 0 });
            room.state.stateVersion++; commit(room);
          }
          const p = room.state.players.get(playerId)!;
          res.setHeader('Set-Cookie', `${playerCookie(room.id)}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400`);
          return json(res, 201, { roomId: room.id, playerId, nickname: p.nickname, avatarId: p.avatarId, sessionToken: 'cookie' });
        }
        const auth = authorize(req, room);
        if (req.method === 'DELETE' && !action) { requireHost(req); endQuiz(room.state); commit(room); return json(res, 200, { status: 'finished' }); }
        if (action === 'media') return json(res, 200, room.quiz.questions.map((q, i) => ({ mediaId: q.id, url: q.essentialImage, questionIndex: i, isEssential: true })).filter(m => m.url));
        if (action === 'snapshot' || action === 'results') return json(res, 200, snapshot(room, auth).payload);
        if (action === 'leave' && req.method === 'POST') {
          if (!auth.playerId || room.state.phase !== 'LOBBY') throw new HttpError(409, 'لا يمكن مغادرة اللوبي الآن.');
          room.state.players.delete(auth.playerId);
          for (const [hash, id] of room.sessions) if (id === auth.playerId) room.sessions.delete(hash);
          room.state.stateVersion++; commit(room);
          for (const c of connections) if (c.roomId === room.id && c.playerId === auth.playerId) c.ws.close(1000);
          return json(res, 200, { status: 'left' });
        }
        throw new HttpError(405, 'العملية غير مدعومة.');
      }
      const image = path.match(/^\/media\/([a-f0-9]{64})$/);
      if (image) {
        const row = store.db.prepare('SELECT mime,bytes FROM media WHERE hash=?').get(image[1]);
        if (!row) throw new HttpError(404, 'الصورة غير موجودة.');
        res.writeHead(200, { 'Content-Type': row.mime as string, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        return res.end(row.bytes);
      }
      if (path.startsWith('/api/') || path.startsWith('/ws/')) throw new HttpError(404, 'المسار غير موجود.');
      if (!['GET', 'HEAD'].includes(req.method || '')) throw new HttpError(405, 'Method not allowed');
      if (/^\/(login|dashboard|builder|questions|quizzes)(\/|$)/.test(path)) {
        res.writeHead(302, { Location: '/local/', 'Cache-Control': 'no-store' }); return res.end();
      }
      const decoded = decodeURIComponent(path);
      const directoryIndex = resolve(root, `.${decoded}`, 'index.html');
      if (!decoded.endsWith('/') && directoryIndex.startsWith(root + sep) && existsSync(directoryIndex) && statSync(directoryIndex).isFile()) {
        res.writeHead(308, { Location: `${path}/${url.search}`, 'Cache-Control': 'no-store' }); return res.end();
      }
      const file = resolve(root, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) throw new HttpError(404, 'الصفحة غير موجودة.');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws://${url.host}; frame-src 'none'` });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 500;
      if (status === 500) console.error('LAN request failed', error);
      if (!res.headersSent) json(res, status, { status, detail: error instanceof HttpError ? error.message : status === 400 ? 'محتوى غير صالح.' : 'تعذّرت العملية. تحقق من الملف وسجل التشغيل.' });
    }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = requestUrl(req);
      if (!req.headers.origin) throw new HttpError(403, 'Origin required');
      const match = url.pathname.match(/^\/ws\/rooms\/([a-f0-9-]{36})$/);
      if (!match) throw new HttpError(404, 'Unknown room');
      const room = reconcile(match[1]);
      const host = url.searchParams.get('role') === 'host';
      const playerId = identity(req, room);
      if (host ? !isHost(req) : !playerId || playerId !== url.searchParams.get('playerId')) throw new HttpError(403, 'Forbidden');
      sockets.handleUpgrade(req, socket, head, ws => {
        const c: Connection = { ws, roomId: room.id, host, playerId: host ? undefined : playerId, recent: [] };
        if (!host) for (const old of connections) if (old.roomId === room.id && old.playerId === playerId) { connections.delete(old); old.ws.close(1008, 'Connection replaced'); }
        connections.add(c); send(ws, snapshot(room, c));
        ws.on('close', () => connections.delete(c));
        ws.on('error', () => connections.delete(c));
        ws.on('message', raw => {
          const receivedAt = now();
          try {
            if (!connections.has(c)) return;
            c.recent = c.recent.filter(t => receivedAt - t < 1000);
            if (c.recent.length >= 10) return ws.close(1008, 'Rate limit');
            c.recent.push(receivedAt);
            const msg = JSON.parse(raw.toString());
            const current = reconcile(c.roomId);
            if (msg.type === 'room.sync') return send(ws, snapshot(current, c, typeof msg.payload?.t0 === 'number' ? msg.payload.t0 : undefined));
            if (msg.type === 'answer.submit' && !c.host && c.playerId) {
              const input = answerSchema.parse(msg.payload);
              const previous = current.state.answers.get(`${input.roundId}:${c.playerId}`);
              if (previous && (previous.optionId !== input.optionId || previous.textAnswer !== input.textAnswer)) {
                return send(ws, { v: 1, type: 'answer.rejected', requestId: msg.requestId, payload: { reason: 'Conflicting duplicate answer' } });
              }
              const result = processAnswerSubmission(current.state, current.quiz, { ...input, playerId: c.playerId }, receivedAt);
              if (result.status !== 'rejected') {
                store.save(current); // Durable ACK boundary. Any exception discards the speculative object.
                send(ws, { v: 1, type: 'answer.receipt', requestId: msg.requestId, serverNow: now(), payload: result.receipt });
                scheduleHostCount(current.id);
              } else send(ws, { v: 1, type: 'answer.rejected', requestId: msg.requestId, serverNow: now(), payload: { reason: result.reason } });
              return;
            }
            if (!c.host || !isHost(req)) throw new HttpError(403, 'Forbidden host command');
            if (msg.type === 'host.start') { if (current.state.phase !== 'LOBBY') return; startQuiz(current.state, current.quiz, receivedAt); }
            else if (msg.type === 'host.end') endQuiz(current.state);
            else if (msg.type === 'host.pause') requestPause(current.state);
            else if (msg.type === 'host.resume') requestResume(current.state, current.quiz, receivedAt);
            else if (msg.type === 'host.recover') handleOverdueRecovery(current.state, z.enum(['void_and_replay', 'void_and_skip']).parse(msg.payload?.action), current.quiz, receivedAt);
            else throw new HttpError(400, 'Unknown message');
            commit(current);
          } catch {
            send(ws, { v: 1, type: 'error', payload: { detail: 'تعذّر تنفيذ الطلب. أعد المحاولة أو الاتصال.' } });
          }
        });
      });
    } catch { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); }
  });
  return {
    server, store, addresses,
    async listen() {
      if (!existsSync(resolve(root, 'local/index.html')) || !readFileSync(resolve(root, 'local/index.html'), 'utf8').includes('brio-runtime-lan')) {
        throw new Error('LAN web build missing. Run pnpm lan:build first.');
      }
      await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(options.port ?? 3210, options.bind ?? '0.0.0.0', () => { server.off('error', fail); ok(); }); });
      for (const room of store.listRooms()) reconcile(room.id);
      return (server.address() as { port: number }).port;
    },
    async close() {
      for (const timer of timers.values()) clearTimeout(timer);
      for (const timer of hostUpdateTimers.values()) clearTimeout(timer);
      for (const c of connections) c.ws.terminate();
      sockets.close();
      await new Promise<void>(done => server.close(() => done())); store.close();
    }
  };
}
