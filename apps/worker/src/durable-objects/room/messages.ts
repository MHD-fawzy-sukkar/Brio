import {
  startQuiz,
  endQuiz,
  processAnswerSubmission,
  reconcileDeadlines,
  requestPause,
  requestResume,
  handleOverdueRecovery,
  toPublicPlayerSnapshot,
  toPublicHostSnapshot,
} from '@brio/game-core';
import { saveAnswerToDb, saveRoomMetaToDb } from '../../rooms/room-storage';
import type { RoomRuntime } from './runtime';
import type { RoomTelemetry } from './telemetry';
import { sendSnapshot } from './broadcast';
import { socketIdentity, verifyHostCommand } from './security';

export async function webSocketMessage(
  room: RoomRuntime,
  telemetry: RoomTelemetry,
  ws: WebSocket,
  message: string | ArrayBuffer,
): Promise<void> {
  await room.ensureInitialized();
  if (!room.quizSnapshot) return;

  const arrivalTime = Date.now();

  // SRS Guard 1: Frame Size Limit (max 4 KiB = 4096 bytes)
  const byteLen =
    typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength;
  if (byteLen > 4096) {
    ws.send(
      JSON.stringify({
        v: 1,
        type: 'error',
        serverNow: arrivalTime,
        payload: { code: 'message_too_large', detail: 'Inbound socket payload exceeds 4 KiB limit' },
      }),
    );
    return;
  }

  // SRS Guard 2: Per-connection Rate Limiter (max 10 msgs / second)
  const timestamps = telemetry.timestamps.get(ws) || [];
  const recentTimestamps = timestamps.filter((t) => arrivalTime - t < 1000);
  if (recentTimestamps.length >= 10) {
    ws.send(
      JSON.stringify({
        v: 1,
        type: 'error',
        serverNow: arrivalTime,
        payload: { code: 'rate_limit_exceeded', detail: 'Too many socket messages. Max 10 per second' },
      }),
    );
    return;
  }
  recentTimestamps.push(arrivalTime);
  telemetry.timestamps.set(ws, recentTimestamps);

  try {
    const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const data = JSON.parse(msgStr);
    const now = Date.now();
    const identity = socketIdentity(room, ws);
    if (!identity.host && !identity.playerId) throw new Error('Session superseded or unauthorized');
    if (typeof data.type !== 'string') throw new Error('Invalid message type');
    if (data.type.startsWith('host.') && (!identity.host || !(await verifyHostCommand(room, ws))))
      throw new Error('Host authentication required');

    if (data.type === 'room.sync') {
      const effects = reconcileDeadlines(room.state, room.quizSnapshot, now);
      if (effects.length > 0) await room.applyEffects(effects);
      const tags: string[] = room.ctx.getTags(ws);
      const playerId = tags.find((tag) => tag.startsWith('player:'))?.slice(7);
      const snapshot = tags.includes('role:host')
        ? toPublicHostSnapshot(room.state, room.quizSnapshot)
        : playerId && room.state.players.has(playerId)
          ? toPublicPlayerSnapshot(room.state, playerId, room.quizSnapshot)
          : null;
      if (snapshot)
        sendSnapshot(
          room,
          telemetry,
          ws,
          JSON.stringify({
            v: 1,
            type: 'room.snapshot',
            stateVersion: room.state.stateVersion,
            serverNow: Date.now(),
            payload: snapshot,
            t0: data.payload?.t0,
          }),
        );
      return;
    }

    // 1. Clock Sample
    if (data.type === 'clock.sample') {
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'clock.sample',
          serverNow: now,
          payload: { t0: data.payload?.t0 },
        }),
      );
      return;
    }

    // 2. Answer Submission (Transactional & Durable ACK with Latency Tracking)
    if (data.type === 'answer.submit') {
      if (
        !identity.playerId ||
        (data.payload?.playerId && data.payload.playerId !== identity.playerId) ||
        (data.playerId && data.playerId !== identity.playerId)
      )
        throw new Error('Cannot submit for another player');
      telemetry.metrics.totalSubmissions++;

      // Short Answer payload length guard (max 200 chars)
      if (
        data.payload?.textAnswer &&
        typeof data.payload.textAnswer === 'string' &&
        data.payload.textAnswer.length > 200
      ) {
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'answer.rejected',
            requestId: data.requestId,
            serverNow: now,
            payload: { reason: 'Short answer text exceeds maximum length of 200 characters' },
          }),
        );
        telemetry.metrics.rejectedSubmissions++;
        return;
      }

      const answerKey = `${data.payload.roundId}:${identity.playerId}`;
      const isDuplicate = room.state.answers.has(answerKey);

      const result = processAnswerSubmission(
        room.state,
        room.quizSnapshot,
        {
          playerId: identity.playerId,
          roundId: data.payload.roundId,
          submissionId: data.payload.submissionId,
          optionId: data.payload.optionId,
          textAnswer: data.payload.textAnswer,
        },
        now,
      );

      if (result.status === 'accepted' || result.status === 'duplicate') {
        if (isDuplicate || result.status === 'duplicate') {
          telemetry.metrics.duplicateSubmissions++;
        }

        // Commit Answer to SQLite Storage FIRST before sending ACK!
        const sql = room.ctx.storage.sql;
        const answerRecord = room.state.answers.get(answerKey);
        if (answerRecord) {
          saveAnswerToDb(sql, answerRecord);
        }
        if (!isDuplicate && result.status === 'accepted') {
          saveRoomMetaToDb(sql, room.state);
          room.broadcastState();
        }

        const ackTime = Date.now();
        const latency = ackTime - arrivalTime;
        telemetry.metrics.ackLatenciesMs.push(latency);
        // Keep bounded latency window
        if (telemetry.metrics.ackLatenciesMs.length > 1000) {
          telemetry.metrics.ackLatenciesMs.shift();
        }

        telemetry.metrics.totalReceiptsEmitted++;

        ws.send(
          JSON.stringify({
            v: 1,
            type: 'answer.receipt',
            requestId: data.requestId,
            serverNow: ackTime,
            payload: result.receipt,
          }),
        );
      } else {
        telemetry.metrics.rejectedSubmissions++;
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'answer.rejected',
            requestId: data.requestId,
            serverNow: now,
            payload: { reason: result.reason },
          }),
        );
      }
      return;
    }

    // 3. Host Controls
    if (data.type === 'host.start') {
      const effects = startQuiz(room.state, room.quizSnapshot, now);
      await room.applyEffects(effects);
      return;
    }

    if (data.type === 'host.end') {
      const effects = endQuiz(room.state);
      await room.applyEffects(effects);
      return;
    }

    if (data.type === 'host.pause') {
      const effects = requestPause(room.state);
      await room.applyEffects(effects);
      return;
    }

    if (data.type === 'host.resume') {
      const effects = requestResume(room.state, room.quizSnapshot, now);
      await room.applyEffects(effects);
      return;
    }

    if (data.type === 'host.recover') {
      const action = data.payload?.action || 'void_and_replay';
      const effects = handleOverdueRecovery(room.state, action, room.quizSnapshot, now);
      await room.applyEffects(effects);
      return;
    }
  } catch (err: any) {
    ws.send(
      JSON.stringify({
        v: 1,
        type: 'error',
        serverNow: Date.now(),
        payload: { code: 'bad_request', detail: err.message || 'Invalid socket frame' },
      }),
    );
  }
}
