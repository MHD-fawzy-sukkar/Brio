import { hostTestEnv } from './testing-fixtures';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { createMockDoStorage, MockWebSocket, mockQuizSnapshot } from './testing-fixtures';
describe('Transactional Answer Submissions & Durable ACK', () => {
  it('persists answer to SQLite before returning durable receipt ACK', async () => {
    const storage = createMockDoStorage();
    const mockCtx = {
      id: { toString: () => 'room_ans' },
      storage: storage,
      getWebSockets: () => [],
      acceptWebSocket: () => {},
      getTags: (ws: MockWebSocket) => ws.tags,
    };

    const doInstance = new GameRoomDO(mockCtx as any, hostTestEnv as any);
    await doInstance.initQuizSnapshot(mockQuizSnapshot);

    // Add player and start quiz
    await doInstance.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p_1', nickname: 'Ali', avatarId: 'avatar_1', sessionHash: 'h1' }),
      }),
    );

    const ws = new MockWebSocket(['player:p_1', 'generation:1']);
    await doInstance.webSocketMessage(new MockWebSocket() as any, JSON.stringify({ type: 'host.start' }));
    assert.equal(doInstance.state.phase, 'COUNTDOWN');

    // Countdown finishes -> Question round begins
    doInstance.state.activeRound!.endsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'QUESTION');

    const activeRound = doInstance.state.activeRound;
    assert.ok(activeRound);

    // Submit answer via WebSocket
    const submissionId = 'sub_001';
    await doInstance.webSocketMessage(
      ws as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_1',
        payload: {
          playerId: 'p_1',
          roundId: activeRound.roundId,
          submissionId,
          optionId: 'opt_2',
        },
      }),
    );

    // Verify receipt ACK sent to client
    assert.equal(ws.sentMessages.length, 1);
    const ackMsg = JSON.parse(ws.sentMessages[0]);
    assert.equal(ackMsg.type, 'answer.receipt');
    assert.equal(ackMsg.payload.status, 'accepted');

    // Verify answer was written to SQLite storage
    const sqlRows = storage.sql.exec('SELECT * FROM answers WHERE submission_id = ?', submissionId);
    assert.equal(sqlRows.length, 1);
    assert.equal(sqlRows[0].player_id, 'p_1');
  });

  it('rejects late answers submitted after round endsAt', async () => {
    const storage = createMockDoStorage();
    const mockCtx = {
      id: { toString: () => 'room_late' },
      storage: storage,
      getWebSockets: () => [],
      acceptWebSocket: () => {},
      getTags: (ws: MockWebSocket) => ws.tags,
    };

    const doInstance = new GameRoomDO(mockCtx as any, hostTestEnv as any);
    await doInstance.initQuizSnapshot(mockQuizSnapshot);

    await doInstance.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'p_1', nickname: 'Ali', avatarId: 'avatar_1', sessionHash: 'h1' }),
      }),
    );

    const ws = new MockWebSocket(['player:p_1', 'generation:1']);
    await doInstance.webSocketMessage(new MockWebSocket() as any, JSON.stringify({ type: 'host.start' }));

    // Countdown finishes -> Question round begins
    doInstance.state.activeRound!.endsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'QUESTION');

    // Force round endsAt into the past
    if (doInstance.state.activeRound) {
      doInstance.state.activeRound.endsAt = Date.now() - 5000;
    }

    await doInstance.webSocketMessage(
      ws as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'req_2',
        payload: {
          playerId: 'p_1',
          roundId: doInstance.state.activeRound!.roundId,
          submissionId: 'sub_late',
          optionId: 'opt_2',
        },
      }),
    );

    const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    assert.equal(lastMsg.type, 'answer.rejected');
    assert.equal(lastMsg.payload.reason, 'Answer submitted outside question time deadline');
  });
});
