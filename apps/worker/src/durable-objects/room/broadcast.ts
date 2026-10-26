import { toPublicPlayerSnapshot, toPublicHostSnapshot, createSnapshotProjection } from '@brio/game-core';
import type { RoomRuntime, RoomSocket } from './runtime';
import type { RoomTelemetry } from './telemetry';

export function broadcastState(room: RoomRuntime, telemetry: RoomTelemetry): void {
  if (!room.quizSnapshot) return;

  const projection = createSnapshotProjection(room.state, room.quizSnapshot);

  // Broadcast to Host WebSocket
  const hostSockets = room.ctx.getWebSockets('role:host');
  for (const ws of hostSockets) {
    const snapshot = toPublicHostSnapshot(room.state, room.quizSnapshot, projection);
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
      }),
    );
  }

  // Broadcast to Player WebSockets
  for (const player of room.state.players.values()) {
    const playerSockets = room.ctx.getWebSockets(`player:${player.id}`);
    for (const ws of playerSockets) {
      const snapshot = toPublicPlayerSnapshot(room.state, player.id, room.quizSnapshot, projection);
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
        }),
      );
    }
  }
}

export function sendSnapshot(
  room: RoomRuntime,
  telemetry: RoomTelemetry,
  ws: RoomSocket,
  message: string,
): void {
  try {
    ws.send(message);
  } catch {
    telemetry.timestamps.delete(ws);
  }
}
