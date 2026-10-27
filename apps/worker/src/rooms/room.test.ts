import { hostTestEnv } from './testing-fixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { toPublicPlayerSnapshot, toPublicHostSnapshot } from '@brio/game-core';
import { createMockDoStorage, MockWebSocket, mockQuizSnapshot } from './testing-fixtures';
test('frozen custom identity survives a Durable Object wake and only its catalog can be selected', async () => {
  const storage = createMockDoStorage();
  const ctx = {
    id: { toString: () => 'identity_room' },
    storage,
    getWebSockets: () => [],
    acceptWebSocket: () => {},
    getTags: () => [],
  };
  const room = new GameRoomDO(ctx, hostTestEnv as any);
  const avatarId = 'identity:00000000-0000-4000-8000-000000000001';
  const src = 'https://res.cloudinary.com/brio/image/upload/v1/team.webp';
  const identity = {
    name: 'Team',
    avatarMode: 'custom' as const,
    character: { kind: 'image' as const, src, label: 'Team', motion: 'float' as const },
    avatars: [{ id: avatarId, src, label: 'Team' }],
  };
  await room.initQuizSnapshot({ ...mockQuizSnapshot, identity });
  const metadata = await room.fetch(new Request('http://internal/identity'));
  assert.deepEqual(await metadata.json(), { identity });
  const join = (avatar: string) =>
    room.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: 'p_identity',
          nickname: 'Player',
          avatarId: avatar,
          sessionHash: 'session',
        }),
      }),
    );
  assert.equal((await join('avatar_1')).status, 400);
  assert.equal((await join(avatarId)).status, 200);
  const woke = new GameRoomDO(ctx, hostTestEnv as any);
  await woke.ensureInitialized();
  assert.deepEqual(woke.quizSnapshot?.identity, identity);
  const player = toPublicPlayerSnapshot(woke.state, 'p_identity', woke.quizSnapshot!);
  assert.deepEqual(player.identity, identity);
  assert.equal(JSON.stringify(player).includes('isCorrect'), false);
  assert.deepEqual(toPublicHostSnapshot(woke.state, woke.quizSnapshot!).identity, identity);
});

test('broken sockets cannot block countdown, question alarms, or the finale for other players', async () => {
  const storage = createMockDoStorage();
  const host = new MockWebSocket();
  const players = [new MockWebSocket(), new MockWebSocket()];
  const broken = {
    send() {
      throw new Error('Socket disconnected');
    },
  };
  const ctx = {
    id: { toString: () => 'room_broken_sockets' },
    storage,
    acceptWebSocket: () => {},
    getWebSockets: (tag: string) =>
      tag === 'role:host'
        ? [broken, host]
        : tag === 'player:p0'
          ? [broken, players[0]]
          : tag === 'player:p1'
            ? [players[1]]
            : [],
    getTags: (ws: unknown) =>
      ws === host ? ['role:host', 'host-session:test'] : ['player:p1', 'generation:1'],
  };
  const room = new GameRoomDO(ctx, hostTestEnv as any);
  await room.initQuizSnapshot({ ...mockQuizSnapshot, questions: [mockQuizSnapshot.questions[0]] });
  for (let i = 0; i < 2; i++) {
    await room.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: `p${i}`,
          nickname: `Player ${i}`,
          avatarId: 'avatar_1',
          sessionHash: `hash_${i}`,
        }),
      }),
    );
  }
  await room.webSocketMessage(host as any, JSON.stringify({ type: 'host.start' }));
  assert.equal(await storage.getAlarm(), room.state.activeRound!.endsAt);
  // An early alarm must retain the pending deadline.
  await storage.deleteAlarm();
  await room.alarm();
  assert.equal(await storage.getAlarm(), room.state.activeRound!.endsAt);
  room.state.activeRound!.endsAt = Date.now() - 100;
  await room.alarm();
  assert.equal(await storage.getAlarm(), room.state.activeRound!.endsAt);
  room.state.activeRound!.endsAt = Date.now() - 100;
  await room.alarm();
  room.state.activeRound!.statsEndsAt = Date.now() - 100;
  // A sync request also repairs a missed final transition.
  await room.webSocketMessage(players[1] as any, JSON.stringify({ type: 'room.sync', payload: { t0: 123 } }));
  for (const ws of [host, ...players]) {
    const messages = ws.sentMessages.map((message) => JSON.parse(message));
    assert.deepEqual(
      [...new Set(messages.map((message) => message.payload.phase))],
      ['LOBBY', 'COUNTDOWN', 'QUESTION', 'STATS', 'FINISHED'],
    );
    assert.equal(messages.at(-1).payload.phase, 'FINISHED');
  }
  const sync = JSON.parse(players[1].sentMessages.at(-1)!);
  assert.equal(sync.t0, 123);
  assert.equal(sync.payload.ownScore, 0);
  assert.equal(sync.payload.leaderboard, undefined);
});
