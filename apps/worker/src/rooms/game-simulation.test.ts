import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { createMockDoStorage, MockWebSocket, mockQuizSnapshot } from './testing-fixtures';
describe('Full 3-Client + Host Game Simulation', () => {
  it('runs complete quiz timeline with 3 players and 2 questions', async () => {
    const storage = createMockDoStorage();
    let broadcastHost: MockWebSocket | null = null;
    const mockCtx = {
      id: { toString: () => 'room_sim' },
      storage: storage,
      getWebSockets: (tag: string) => (tag === 'role:host' && broadcastHost ? [broadcastHost] : []),
      acceptWebSocket: () => {},
    };

    const doInstance = new GameRoomDO(mockCtx as any, {} as any);
    await doInstance.initQuizSnapshot(mockQuizSnapshot);

    // 3 Players join
    for (const [id, nick] of [
      ['p1', 'Omar'],
      ['p2', 'Fatima'],
      ['p3', 'Yara'],
    ]) {
      await doInstance.fetch(
        new Request('http://internal/join', {
          method: 'POST',
          body: JSON.stringify({
            playerId: id,
            nickname: nick,
            avatarId: 'avatar_1',
            sessionHash: `hash_${id}`,
          }),
        }),
      );
    }
    assert.equal(doInstance.state.players.size, 3);

    await doInstance.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: 'leaving',
          nickname: 'Leaving',
          avatarId: 'avatar_2',
          sessionHash: 'leave_hash',
        }),
      }),
    );
    const leaveResponse = await doInstance.fetch(
      new Request('http://internal/leave', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'leaving', sessionHash: 'leave_hash' }),
      }),
    );
    assert.equal(leaveResponse.status, 200);
    assert.equal(doInstance.state.players.size, 3);

    const hostWs = new MockWebSocket();
    broadcastHost = hostWs;

    // 1. Host Starts Game -> COUNTDOWN
    await doInstance.webSocketMessage(hostWs as any, JSON.stringify({ type: 'host.start' }));
    assert.equal(doInstance.state.phase, 'COUNTDOWN');
    assert.equal(doInstance.state.currentQuestionIndex, 0);
    const lateJoin = await doInstance.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: 'late',
          nickname: 'Late',
          avatarId: 'avatar_2',
          sessionHash: 'late_hash',
        }),
      }),
    );
    assert.equal(lateJoin.status, 200);
    assert.equal(doInstance.state.players.has('late'), true);

    // 2. Alarm triggers -> QUESTION 1 phase (Q1 MultipleChoice)
    doInstance.state.activeRound!.endsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'QUESTION');

    const round1 = doInstance.state.activeRound!;

    // 3. Players Submit Answers for Q1
    // p1 submits correct (opt_2), p2 submits wrong (opt_1), p3 submits correct (opt_2)
    await doInstance.webSocketMessage(
      hostWs as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p1',
        payload: { playerId: 'p1', roundId: round1.roundId, submissionId: 'sub_r1_p1', optionId: 'opt_2' },
      }),
    );
    await doInstance.webSocketMessage(
      hostWs as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p2',
        payload: { playerId: 'p2', roundId: round1.roundId, submissionId: 'sub_r1_p2', optionId: 'opt_1' },
      }),
    );
    await doInstance.webSocketMessage(
      hostWs as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'r1_p3',
        payload: { playerId: 'p3', roundId: round1.roundId, submissionId: 'sub_r1_p3', optionId: 'opt_2' },
      }),
    );
    const liveSnapshots = hostWs.sentMessages
      .map((message) => JSON.parse(message))
      .filter((message) => message.type === 'room.snapshot');
    assert.equal(liveSnapshots.at(-1)?.payload.acceptedAnswersCount, 3);

    // 4. Trigger Alarm -> Advances to STATS phase (Q1 scored)
    round1.endsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'STATS');

    // Check player scores after Q1
    assert.ok(doInstance.state.players.get('p1')!.score > 0);
    assert.equal(doInstance.state.players.get('p2')!.score, 0);
    assert.ok(doInstance.state.players.get('p3')!.score > 0);

    // Score persistence survives a Durable Object cold wake (prefix sum source of truth).
    const coldWake = new GameRoomDO(mockCtx as any, {} as any);
    await coldWake.ensureInitialized();
    assert.equal(coldWake.state.players.get('p1')!.score, doInstance.state.players.get('p1')!.score);
    assert.equal(coldWake.state.players.get('p2')!.score, 0);

    // 5. Trigger Alarm -> Advances to LEADERBOARD phase
    round1.statsEndsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'LEADERBOARD');

    // 6. Trigger Alarm -> LEADERBOARD ends -> Starts Q2 directly in QUESTION phase!
    round1.rankingEndsAt = Date.now() - 1000;
    await doInstance.alarm();
    assert.equal(doInstance.state.phase, 'QUESTION');
    assert.equal(doInstance.state.currentQuestionIndex, 1);

    const round2 = doInstance.state.activeRound!;

    // Players Submit Short Answer text for Q2
    await doInstance.webSocketMessage(
      hostWs as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'r2_p1',
        payload: { playerId: 'p1', roundId: round2.roundId, submissionId: 'sub_r2_p1', textAnswer: 'Paris' },
      }),
    );
    await doInstance.webSocketMessage(
      hostWs as any,
      JSON.stringify({
        type: 'answer.submit',
        requestId: 'r2_p2',
        payload: { playerId: 'p2', roundId: round2.roundId, submissionId: 'sub_r2_p2', textAnswer: 'باريس' },
      }),
    );

    // 7. Complete Q2 timeline -> STATS -> FINISHED (no final intermediate leaderboard)
    round2.endsAt = Date.now() - 1000;
    await doInstance.alarm(); // STATS
    round2.statsEndsAt = Date.now() - 1000;
    await doInstance.alarm(); // FINISHED

    assert.equal(doInstance.state.phase, 'FINISHED');
    assert.equal(doInstance.state.players.get('p2')!.score > 0, true); // Arabic answer matched!
    const afterFinishJoin = await doInstance.fetch(
      new Request('http://internal/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: 'too_late',
          nickname: 'Too Late',
          avatarId: 'avatar_3',
          sessionHash: 'too_late_hash',
        }),
      }),
    );
    assert.equal(afterFinishJoin.status, 409);
  });
});
