import { reconcileDeadlines, type EngineEffect } from '@brio/game-core';
import {
  savePlayerScoreToDb,
  saveRoundToDb,
  saveAnswerToDb,
  saveRoomMetaToDb,
} from '../../rooms/room-storage';
import { markRoomFinished } from '../../repositories/room-directory.repository';
import type { RoomRuntime } from './runtime';
import type { RoomTelemetry } from './telemetry';

export async function applyEffects(
  room: RoomRuntime,
  telemetry: RoomTelemetry,
  effects: EngineEffect[],
): Promise<void> {
  const sql = room.ctx.storage.sql;

  for (const effect of effects) {
    if (effect.type === 'PERSIST_STATE') {
      saveRoomMetaToDb(sql, room.state);
      if (room.state.activeRound) {
        saveRoundToDb(sql, room.state.activeRound);
      }
    } else if (effect.type === 'PERSIST_SCORES') {
      for (const player of room.state.players.values()) savePlayerScoreToDb(sql, player);
      const roundId = room.state.activeRound?.roundId;
      if (roundId) {
        for (const answer of room.state.answers.values()) {
          if (answer.roundId === roundId) saveAnswerToDb(sql, answer);
        }
      }
    } else if (effect.type === 'BROADCAST_STATE') {
      room.broadcastState();
    } else if (effect.type === 'SCHEDULE_ALARM' && effect.dueAt) {
      await room.ctx.storage.setAlarm(effect.dueAt);
    } else if (effect.type === 'CANCEL_ALARM') {
      await room.ctx.storage.deleteAlarm();
    }
  }

  if (room.state.phase === 'FINISHED' && room.state.roomId && room.env.DB) {
    await markRoomFinished(room.env.DB, room.state.roomId);
  }
}

export async function alarm(room: RoomRuntime, telemetry: RoomTelemetry): Promise<void> {
  await room.ensureInitialized();
  if (!room.quizSnapshot) return;

  const now = Date.now();
  const effects = reconcileDeadlines(room.state, room.quizSnapshot, now);
  await room.applyEffects(effects);
  if (effects.length === 0 && room.state.activeRound) {
    const round = room.state.activeRound;
    const dueAt =
      room.state.phase === 'STATS'
        ? round.statsEndsAt
        : room.state.phase === 'LEADERBOARD'
          ? round.rankingEndsAt
          : room.state.phase === 'COUNTDOWN' || room.state.phase === 'QUESTION'
            ? round.endsAt
            : 0;
    if (dueAt > now) await room.ctx.storage.setAlarm(dueAt);
  }
}
