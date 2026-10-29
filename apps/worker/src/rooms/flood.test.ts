import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { createMockDoStorage, hostTestEnv, MockWebSocket, mockQuizSnapshot } from './testing-fixtures';

test('socket floods stay bounded across reconnects and do not throttle other players', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const storage = createMockDoStorage();
  const room = new GameRoomDO(
    {
      id: { toString: () => 'flood' },
      storage,
      getWebSockets: () => [],
      acceptWebSocket: () => {},
      getTags: (ws: MockWebSocket) => ws.tags,
    } as any,
    hostTestEnv as any,
  );
  await room.initQuizSnapshot(mockQuizSnapshot);
  for (const id of ['one', 'two', 'three'])
    await room.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: id, nickname: id, avatarId: 'avatar_1', sessionHash: id }),
      }),
    );
  const sync = JSON.stringify({ type: 'room.sync' });
  const sockets: MockWebSocket[] = [];
  for (let i = 0; i < 100; i++) {
    const ws = new MockWebSocket(['player:one', 'generation:1']);
    sockets.push(ws);
    await room.webSocketMessage(ws as any, sync);
  }
  const replies = sockets.flatMap((ws) => ws.sentMessages.map((raw) => JSON.parse(raw)));
  assert.equal(replies.filter((r) => r.type === 'room.snapshot').length, 30);
  assert.equal(replies.filter((r) => r.payload?.code === 'rate_limit_exceeded').length, 70);
  const other = new MockWebSocket(['player:two', 'generation:1']);
  await room.webSocketMessage(other as any, sync);
  assert.equal(JSON.parse(other.sentMessages[0]).type, 'room.snapshot');
  t.mock.timers.tick(10000);
  const resumed = new MockWebSocket(['player:one', 'generation:1']);
  await room.webSocketMessage(resumed as any, sync);
  assert.equal(JSON.parse(resumed.sentMessages[0]).type, 'room.snapshot');
  const single = new MockWebSocket(['player:three', 'generation:1']);
  for (let i = 0; i < 100; i++) await room.webSocketMessage(single as any, sync);
  assert.equal(single.sentMessages.length, 11);
  assert.equal(JSON.parse(single.sentMessages.at(-1)!).payload.code, 'rate_limit_exceeded');
});
