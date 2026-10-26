import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { createMockDoStorage, mockQuizSnapshot } from './testing-fixtures';
describe('GameRoomDO SQLite Wake & State Reconstruction', () => {
  it('reconstructs full game state from SQLite on cold wake', async () => {
    const storage = createMockDoStorage();
    const doId = 'room_123';
    const mockCtx = {
      id: { toString: () => doId },
      storage: storage,
      getWebSockets: () => [],
      acceptWebSocket: () => {},
    };

    // 1. First DO instance initializes snapshot and adds player
    const do1 = new GameRoomDO(mockCtx as any, {} as any);
    await do1.initQuizSnapshot(mockQuizSnapshot);

    await do1.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'p_101',
          nickname: 'Ahmad',
          avatarId: 'avatar_1',
          sessionHash: 'hash_101',
        }),
      }),
    );

    assert.equal(do1.state.players.size, 1);
    assert.equal(do1.state.players.get('p_101')?.nickname, 'Ahmad');

    // 2. Simulate cold wake (New DO instance with SAME storage)
    const do2 = new GameRoomDO(mockCtx as any, {} as any);
    await do2.ensureInitialized();

    // State and Quiz snapshot must be fully reconstructed
    assert.equal(do2.quizSnapshot?.id, 'quiz_v1');
    assert.equal(do2.state.roomId, doId);
    assert.equal(do2.state.players.size, 1);
    assert.equal(do2.state.players.get('p_101')?.nickname, 'Ahmad');
  });
});
