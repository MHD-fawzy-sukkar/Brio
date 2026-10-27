import { hostTestEnv } from './rooms/testing-fixtures';
import assert from 'node:assert/strict';
import test from 'node:test';
import { GameRoomDO } from './durable-objects/GameRoomDO';
import { app } from './app';
import { hashSessionToken, parseCookies, validateOrigin } from './auth/session';
import { createMockDoStorage, MockWebSocket, mockQuizSnapshot } from './rooms/testing-fixtures';

test('cross-origin WebSocket GET, mutations and logout fail before touching storage', async () => {
  for (const [path, method, extra] of [
    ['/ws/rooms/test?role=host', 'GET', { Upgrade: 'websocket' }],
    ['/api/auth/logout', 'POST', {}],
    ['/api/rooms/test/join', 'POST', {}],
    ['/api/media/signature', 'POST', {}],
  ] as const) {
    const response = await app.fetch(
      new Request(`https://brio.test${path}`, {
        method,
        headers: { Origin: 'https://evil.test', ...extra },
      }),
      hostTestEnv as any,
    );
    assert.equal(response.status, 403);
  }
  assert.equal(
    validateOrigin(new Request('https://brio.test/ws', { headers: { Upgrade: 'websocket' } })),
    false,
  );
  assert.equal(
    validateOrigin(
      new Request('https://brio.test/ws', { headers: { Upgrade: 'websocket', Origin: 'https://brio.test' } }),
    ),
    true,
  );
  assert.deepEqual(parseCookies('bad=%ZZ; valid=ok'), { valid: 'ok' });
});

test('cloud deployments refuse development bypass and oversized request bodies', async () => {
  const unsafe = await app.fetch(new Request('https://brio.test/api/health'), {
    DEV_AUTH_BYPASS: 'true',
  } as any);
  assert.equal(unsafe.status, 503);
  const large = await app.fetch(
    new Request('https://brio.test/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://brio.test' },
      body: 'x'.repeat(2 * 1024 * 1024 + 1),
    }),
    hostTestEnv as any,
  );
  assert.equal(large.status, 413);
});

test('room rejects stolen player IDs, forged host controls, stale sockets and unauthenticated snapshots', async () => {
  const storage = createMockDoStorage();
  const ctx = {
    id: { toString: () => 'secure' },
    storage,
    getWebSockets: () => [],
    acceptWebSocket: () => {},
    getTags: (ws: MockWebSocket) => ws.tags,
  };
  const room = new GameRoomDO(ctx as any, hostTestEnv as any);
  await room.initQuizSnapshot(mockQuizSnapshot);
  for (const id of ['p1', 'p2'])
    await room.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: id,
          nickname: id,
          avatarId: 'avatar_1',
          sessionHash: await hashSessionToken(`token-${id}`),
        }),
      }),
    );
  const player = new MockWebSocket(['player:p1', 'generation:1']);
  for (const type of ['host.start', 'host.end', 'host.pause', 'host.resume', 'host.recover'])
    await room.webSocketMessage(player as any, JSON.stringify({ type }));
  assert.equal(room.state.phase, 'LOBBY');
  const unknown = await room.fetch(
    new Request('http://internal/ws/rooms/secure?role=player&playerId=p1&sessionToken=stolen', {
      headers: { Upgrade: 'websocket' },
    }),
  );
  assert.equal(unknown.status, 401);
  assert.equal((await room.fetch(new Request('http://internal/snapshot?playerId=p1'))).status, 401);
  assert.equal((await room.fetch(new Request('http://internal/snapshot'))).status, 401);
  assert.equal(
    (
      await room.fetch(
        new Request('http://internal/snapshot?playerId=p1', {
          headers: { 'X-Brio-Player-Token': 'token-p1' },
        }),
      )
    ).status,
    200,
  );
  await room.webSocketMessage(new MockWebSocket() as any, JSON.stringify({ type: 'host.start' }));
  room.state.activeRound!.endsAt = Date.now() - 100;
  await room.alarm();
  const payload = {
    playerId: 'p2',
    roundId: room.state.activeRound!.roundId,
    submissionId: 'forged',
    optionId: 'opt_2',
  };
  await room.webSocketMessage(player as any, JSON.stringify({ type: 'answer.submit', payload }));
  assert.equal(room.state.answers.size, 0);
  payload.playerId = 'p1';
  await room.webSocketMessage(player as any, JSON.stringify({ type: 'answer.submit', payload }));
  assert.equal(room.state.answers.size, 1);
  room.state.players.get('p1')!.connectionGeneration++;
  await room.webSocketMessage(player as any, JSON.stringify({ type: 'room.sync' }));
  assert.match(JSON.parse(player.sentMessages.at(-1)!).payload.detail, /superseded/);
  const woke = new GameRoomDO(ctx as any, hostTestEnv as any);
  assert.equal(
    (
      await woke.fetch(
        new Request('http://internal/snapshot?playerId=p1', {
          headers: { 'X-Brio-Player-Token': 'token-p1' },
        }),
      )
    ).status,
    200,
  );
});
