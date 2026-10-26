import { isCompetitionAvatarAllowed } from '@brio/contracts';
import { endQuiz, toPublicPlayerSnapshot, toPublicHostSnapshot } from '@brio/game-core';
import {
  countRoomParticipations,
  savePlayerToDb,
  removeLobbyPlayerFromDb,
  saveRoomMetaToDb,
} from '../../rooms/room-storage';
import type { RoomRuntime } from './runtime';
import type { RoomTelemetry } from './telemetry';

export async function fetch(
  room: RoomRuntime,
  telemetry: RoomTelemetry,
  request: Request,
): Promise<Response> {
  await room.ensureInitialized();
  const url = new URL(request.url);

  // 1. Initial DO Setup HTTP endpoint (for Worker Room Creation)
  if (url.pathname.endsWith('/setup') && request.method === 'POST') {
    const body = (await request.json()) as any;
    if (body.quizSnapshot) {
      room.state.roomId = body.roomId;
      await room.initQuizSnapshot({ ...body.quizSnapshot, roomCode: body.code });
      return new Response(JSON.stringify({ status: 'ok', roomId: room.ctx.id.toString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (url.pathname.endsWith('/close') && request.method === 'POST') {
    const effects = endQuiz(room.state);
    await room.applyEffects(effects);
    return new Response(JSON.stringify({ status: 'finished' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.pathname.endsWith('/identity') && request.method === 'GET') {
    return new Response(JSON.stringify({ identity: room.quizSnapshot?.identity ?? null }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // Internal Worker-to-object aggregation; never exposed through a public route.
  if (url.pathname === '/participations' && request.method === 'GET') {
    return Response.json({
      count: countRoomParticipations(room.ctx.storage.sql),
      finished: room.state.phase === 'FINISHED',
    });
  }

  // 2. Player Join HTTP endpoint
  if (url.pathname.endsWith('/join') && request.method === 'POST') {
    if (!room.quizSnapshot)
      return new Response(JSON.stringify({ detail: 'Game not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    if (room.state.phase === 'FINISHED')
      return new Response(JSON.stringify({ detail: 'Game has finished' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    const body = (await request.json()) as any;
    const { playerId, nickname, avatarId, sessionHash } = body;
    let player = room.state.players.get(playerId);
    if (!player) {
      if (room.quizSnapshot.identity && !isCompetitionAvatarAllowed(room.quizSnapshot.identity, avatarId)) {
        return new Response(JSON.stringify({ detail: 'اختر صورة متاحة ضمن هذه المسابقة.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      player = {
        id: playerId,
        nickname,
        avatarId,
        score: 0,
        joinedAt: Date.now(),
        connectionGeneration: 1,
      };
      room.state.players.set(playerId, player);
    } else {
      player.connectionGeneration++;
    }
    room.state.stateVersion++;

    const sql = room.ctx.storage.sql;
    savePlayerToDb(sql, player, sessionHash);
    saveRoomMetaToDb(sql, room.state);

    room.broadcastState();

    return new Response(
      JSON.stringify({
        status: 'ok',
        playerId: player.id,
        nickname: player.nickname,
        avatarId: player.avatarId,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (url.pathname.endsWith('/leave') && request.method === 'POST') {
    if (room.state.phase !== 'LOBBY')
      return new Response(JSON.stringify({ detail: 'The game has already started' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    const { playerId, sessionHash } = (await request.json()) as any;
    const removed = removeLobbyPlayerFromDb(room.ctx.storage.sql, playerId, sessionHash);
    if (!removed || !room.state.players.delete(playerId))
      return new Response(JSON.stringify({ detail: 'Player session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    room.state.stateVersion++;
    saveRoomMetaToDb(room.ctx.storage.sql, room.state);
    room.broadcastState();
    return new Response(JSON.stringify({ status: 'left' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Media Manifest endpoint
  if (url.pathname.endsWith('/media')) {
    if (!room.quizSnapshot) {
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }
    const items = room.quizSnapshot.questions
      .map((q, idx) => ({
        mediaId: q.id,
        url: q.essentialImage || '',
        questionIndex: idx,
        isEssential: true,
      }))
      .filter((item) => Boolean(item.url));
    return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
  }

  // 4. Aggregated Metrics endpoint
  if (url.pathname.endsWith('/metrics')) {
    telemetry.calculatePercentiles();
    return new Response(
      JSON.stringify({
        ...telemetry.metrics,
        ackLatenciesMs: undefined, // Hide raw array, show summary
        playerCount: room.state.players.size,
        phase: room.state.phase,
        stateVersion: room.state.stateVersion,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 5. WebSocket Upgrade Request
  if (url.pathname.startsWith('/ws/')) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const role = url.searchParams.get('role') || 'player';
    const playerId = url.searchParams.get('playerId') || '';

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const tag = role === 'host' ? 'role:host' : `player:${playerId}`;
    room.ctx.acceptWebSocket(server, [tag]);

    // Send immediate snapshot on connect
    if (room.quizSnapshot) {
      if (role === 'host') {
        const snapshot = toPublicHostSnapshot(room.state, room.quizSnapshot);
        server.send(
          JSON.stringify({
            v: 1,
            type: 'room.snapshot',
            stateVersion: room.state.stateVersion,
            serverNow: Date.now(),
            payload: snapshot,
          }),
        );
      } else if (playerId && room.state.players.has(playerId)) {
        const snapshot = toPublicPlayerSnapshot(room.state, playerId, room.quizSnapshot);
        server.send(
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

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // 6. HTTP Snapshot Fallback
  if (url.pathname.endsWith('/snapshot')) {
    const playerId = url.searchParams.get('playerId');
    if (playerId && room.state.players.has(playerId) && room.quizSnapshot) {
      const snapshot = toPublicPlayerSnapshot(room.state, playerId, room.quizSnapshot);
      return new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } });
    } else if (room.quizSnapshot) {
      const snapshot = toPublicHostSnapshot(room.state, room.quizSnapshot);
      return new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ status: 'active', DO: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
