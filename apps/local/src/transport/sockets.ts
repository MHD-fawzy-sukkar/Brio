import { WebSocketServer } from 'ws';
import { z } from 'zod';
import {
  startQuiz,
  endQuiz,
  processAnswerSubmission,
  requestPause,
  requestResume,
  handleOverdueRecovery,
} from '@brio/game-core';
import type { Server } from 'node:http';
import type { LanRuntime } from '../runtime';
import { answerSchema, HttpError, Connection } from './protocol';
export function attachLanSockets(server: Server, runtime: LanRuntime) {
  const {
    store,
    now,
    connections,
    isHost,
    identity,
    send,
    snapshot,
    scheduleHostCount,
    commit,
    reconcile,
    requestUrl,
  } = runtime;
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
      if (host ? !isHost(req) : !playerId || playerId !== url.searchParams.get('playerId'))
        throw new HttpError(403, 'Forbidden');
      sockets.handleUpgrade(req, socket, head, (ws) => {
        const c: Connection = {
          ws,
          roomId: room.id,
          host,
          playerId: host ? undefined : playerId,
          recent: [],
        };
        if (!host)
          for (const old of connections)
            if (old.roomId === room.id && old.playerId === playerId) {
              connections.delete(old);
              old.ws.close(1008, 'Connection replaced');
            }
        connections.add(c);
        send(ws, snapshot(room, c));
        ws.on('close', () => connections.delete(c));
        ws.on('error', () => connections.delete(c));
        ws.on('message', (raw) => {
          const receivedAt = now();
          try {
            if (!connections.has(c)) return;
            c.recent = c.recent.filter((t) => receivedAt - t < 1000);
            if (c.recent.length >= 10) return ws.close(1008, 'Rate limit');
            c.recent.push(receivedAt);
            const msg = JSON.parse(raw.toString());
            const current = reconcile(c.roomId);
            if (msg.type === 'room.sync')
              return send(
                ws,
                snapshot(current, c, typeof msg.payload?.t0 === 'number' ? msg.payload.t0 : undefined),
              );
            if (msg.type === 'answer.submit' && !c.host && c.playerId) {
              const input = answerSchema.parse(msg.payload);
              const previous = current.state.answers.get(`${input.roundId}:${c.playerId}`);
              if (
                previous &&
                (previous.optionId !== input.optionId || previous.textAnswer !== input.textAnswer)
              ) {
                return send(ws, {
                  v: 1,
                  type: 'answer.rejected',
                  requestId: msg.requestId,
                  payload: { reason: 'Conflicting duplicate answer' },
                });
              }
              const result = processAnswerSubmission(
                current.state,
                current.quiz,
                { ...input, playerId: c.playerId },
                receivedAt,
              );
              if (result.status !== 'rejected') {
                store.save(current); // Durable ACK boundary. Any exception discards the speculative object.
                send(ws, {
                  v: 1,
                  type: 'answer.receipt',
                  requestId: msg.requestId,
                  serverNow: now(),
                  payload: result.receipt,
                });
                scheduleHostCount(current.id);
              } else
                send(ws, {
                  v: 1,
                  type: 'answer.rejected',
                  requestId: msg.requestId,
                  serverNow: now(),
                  payload: { reason: result.reason },
                });
              return;
            }
            if (!c.host || !isHost(req)) throw new HttpError(403, 'Forbidden host command');
            if (msg.type === 'host.start') {
              if (current.state.phase !== 'LOBBY') return;
              startQuiz(current.state, current.quiz, receivedAt);
            } else if (msg.type === 'host.end') endQuiz(current.state);
            else if (msg.type === 'host.pause') requestPause(current.state);
            else if (msg.type === 'host.resume') requestResume(current.state, current.quiz, receivedAt);
            else if (msg.type === 'host.recover')
              handleOverdueRecovery(
                current.state,
                z.enum(['void_and_replay', 'void_and_skip']).parse(msg.payload?.action),
                current.quiz,
                receivedAt,
              );
            else throw new HttpError(400, 'Unknown message');
            commit(current);
          } catch {
            send(ws, {
              v: 1,
              type: 'error',
              payload: { detail: 'تعذّر تنفيذ الطلب. أعد المحاولة أو الاتصال.' },
            });
          }
        });
      });
    } catch {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });
  return sockets;
}
