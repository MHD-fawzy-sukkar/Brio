import { type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { WebSocket } from 'ws';
import {
  reconcileDeadlines,
  createSnapshotProjection,
  type SnapshotProjection,
  toPublicHostSnapshot,
  toPublicPlayerSnapshot,
} from '@brio/game-core';
import { LocalStore, type Room } from './store';
import { digest, cookie, playerCookie, HttpError, Connection } from './transport/protocol';
export type LanServerOptions = {
  database: string;
  webRoot: string;
  port?: number;
  bind?: string;
  now?: () => number;
};
export function createLanRuntime(options: LanServerOptions) {
  const store = new LocalStore(options.database);

  const now = options.now || Date.now;

  let adminSession = randomBytes(32).toString('hex');

  const root = resolve(options.webRoot);

  const connections = new Set<Connection>();

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const hostUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const addresses = Object.values(networkInterfaces())
    .flatMap((items) => items || [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);

  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...addresses]);

  const isHost = (req: IncomingMessage) => digest(cookie(req, 'brio_lan_admin')) === digest(adminSession);

  const identity = (req: IncomingMessage, room: Room) =>
    room.sessions.get(digest(cookie(req, playerCookie(room.id))));

  const getRoom = (id: string) => {
    const room = store.load(id);
    if (!room) throw new HttpError(404, 'الغرفة غير موجودة.');
    return room;
  };

  function authorize(req: IncomingMessage, room: Room) {
    const host = isHost(req),
      playerId = identity(req, room);
    if (!host && !playerId) throw new HttpError(401, 'انضم إلى الغرفة أولاً.');
    return { host, playerId };
  }

  function requireHost(req: IncomingMessage) {
    if (!isHost(req)) throw new HttpError(401, 'افتح لوحة المقدّم من جهاز التشغيل أولاً.');
  }

  function send(ws: WebSocket, data: unknown) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 256 * 1024) return ws.close(1013, 'Reconnect');
    ws.send(JSON.stringify(data));
  }

  function snapshot(
    room: Room,
    c: Pick<Connection, 'host' | 'playerId'>,
    t0?: number,
    projection?: SnapshotProjection,
  ) {
    const payload = c.host
      ? toPublicHostSnapshot(room.state, room.quiz, projection)
      : toPublicPlayerSnapshot(room.state, c.playerId!, room.quiz, projection);
    // Personal receipt restores accepted UI after refresh without revealing correctness.
    const answer =
      room.state.activeRound && c.playerId
        ? room.state.answers.get(`${room.state.activeRound.roundId}:${c.playerId}`)
        : null;
    return {
      v: 1,
      type: 'room.snapshot',
      stateVersion: room.state.stateVersion,
      serverNow: now(),
      t0,
      payload: {
        ...payload,
        ...(answer
          ? {
              ownReceipt: {
                submissionId: answer.submissionId,
                acceptedAt: answer.receivedAt,
                optionId: answer.optionId,
                textAnswer: answer.textAnswer,
              },
            }
          : {}),
      },
    };
  }

  function broadcast(room: Room) {
    const projection = createSnapshotProjection(room.state, room.quiz);
    for (const c of connections)
      if (c.roomId === room.id) send(c.ws, snapshot(room, c, undefined, projection));
  }

  function scheduleHostCount(roomId: string) {
    if (hostUpdateTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      hostUpdateTimers.delete(roomId);
      const room = store.load(roomId);
      if (room) for (const c of connections) if (c.roomId === roomId && c.host) send(c.ws, snapshot(room, c));
    }, 1000);
    timer.unref();
    hostUpdateTimers.set(roomId, timer);
  }

  function schedule(room: Room) {
    clearTimeout(timers.get(room.id));
    timers.delete(room.id);
    const r = room.state.activeRound;
    if (!r) return;
    const due =
      room.state.phase === 'STATS'
        ? r.statsEndsAt
        : room.state.phase === 'LEADERBOARD'
          ? r.rankingEndsAt
          : ['COUNTDOWN', 'QUESTION'].includes(room.state.phase)
            ? r.endsAt
            : 0;
    if (!due) return;
    const tick = () => {
      try {
        reconcile(room.id);
      } catch (error) {
        console.error('LAN deadline persistence failed', error);
        const retry = setTimeout(tick, 1000);
        retry.unref();
        timers.set(room.id, retry);
      }
    };
    const timer = setTimeout(tick, Math.max(1, due - now()));
    timer.unref();
    timers.set(room.id, timer);
  }

  function commit(room: Room) {
    // Synchronous SQLite statement commits before any broadcast/ACK; discarded room objects never become authority.
    store.save(room);
    schedule(room);
    broadcast(room);
  }

  function reconcile(id: string) {
    const room = getRoom(id);
    const effects = reconcileDeadlines(room.state, room.quiz, now());
    if (effects.length) commit(room);
    else schedule(room);
    return room;
  }

  async function body(req: IncomingMessage, limit = 8192): Promise<any> {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) throw new HttpError(413, 'حجم الملف أكبر من الحد المسموح.');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'تعذّر قراءة الملف. اختر ملف المسابقة الذي نزّلته من مسابقاتك.');
    }
  }

  function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(value));
  }

  function requestUrl(req: IncomingMessage) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!allowedHosts.has(url.hostname)) throw new HttpError(403, 'عنوان المضيف غير مسموح.');
    if (req.headers.origin && req.headers.origin !== url.origin)
      throw new HttpError(403, 'طلب من مصدر غير مسموح.');
    if (!['GET', 'HEAD'].includes(req.method || '') && !req.headers.origin)
      throw new HttpError(403, 'Origin required');
    return url;
  }
  return {
    store,
    now,
    root,
    connections,
    timers,
    hostUpdateTimers,
    addresses,
    allowedHosts,
    isHost,
    identity,
    getRoom,
    authorize,
    requireHost,
    send,
    snapshot,
    broadcast,
    scheduleHostCount,
    schedule,
    commit,
    reconcile,
    body,
    json,
    requestUrl,
    get adminSession() {
      return adminSession;
    },
    set adminSession(value: string) {
      adminSession = value;
    },
  };
}
export type LanRuntime = ReturnType<typeof createLanRuntime>;
