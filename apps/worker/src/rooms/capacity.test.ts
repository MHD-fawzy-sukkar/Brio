import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reserveRoomSlot,
  findRoomByCode,
  finishRoomForCreator,
} from '../repositories/room-directory.repository';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { createMockD1Database, createMockDoStorage, mockQuizSnapshot } from './testing-fixtures';
describe('D1 Pilot Capacity Reservations', () => {
  it('replaces a creator stale room and still enforces the global ceiling', async () => {
    const db = createMockD1Database();

    // Creator 1 reserves room 1 -> Success
    const r1 = await reserveRoomSlot(db, 'creator_1', 'qv_1');
    assert.ok(r1.roomId);
    assert.equal(r1.code.length, 6);

    // A second start by the same creator gracefully replaces the stale room.
    const replacement = await reserveRoomSlot(db, 'creator_1', 'qv_2');
    assert.deepEqual(replacement.replacedRoomIds, [r1.roomId]);
    assert.equal(await findRoomByCode(db, r1.code), null);

    // Creator 2 reserves room 2 -> Success (Global count = 2)
    const r2 = await reserveRoomSlot(db, 'creator_2', 'qv_3');
    assert.ok(r2.roomId);

    // Creator 3 attempts to reserve room 3 -> Fails (Global Capacity 2 Reached)
    await assert.rejects(() => reserveRoomSlot(db, 'creator_3', 'qv_4'), /Global pilot capacity reached/);

    // Verify PIN lookup works for Creator 1's replacement room
    const found = await findRoomByCode(db, replacement.code);
    assert.ok(found);
    assert.equal(found.room_id, replacement.roomId);
    assert.equal(found.status, 'reserved');
  });

  it('allows start, explicit end, and immediate restart without creator quota lockout', async () => {
    const db = createMockD1Database();
    const first = await reserveRoomSlot(db, 'creator_restart', 'qv_1');
    assert.ok(await findRoomByCode(db, first.code));

    assert.equal(await finishRoomForCreator(db, first.roomId, 'creator_restart'), true);
    assert.equal(await findRoomByCode(db, first.code), null);

    const second = await reserveRoomSlot(db, 'creator_restart', 'qv_2');
    assert.ok(second.roomId);
    assert.notEqual(second.roomId, first.roomId);
    assert.deepEqual(second.replacedRoomIds, []);
  });

  it('synchronizes Durable Object finish to D1 before an immediate new room', async () => {
    const db = createMockD1Database();
    const first = await reserveRoomSlot(db, 'creator_do_finish', 'qv_1');
    const storage = createMockDoStorage();
    const ctx = {
      id: { toString: () => first.roomId },
      storage,
      getWebSockets: () => [],
      acceptWebSocket: () => {},
    };
    const room = new GameRoomDO(ctx as any, { DB: db } as any);
    await room.fetch(
      new Request('http://internal/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: first.roomId, code: first.code, quizSnapshot: mockQuizSnapshot }),
      }),
    );
    const closed = await room.fetch(new Request('http://internal/close', { method: 'POST' }));
    assert.equal(closed.status, 200);
    assert.equal(await findRoomByCode(db, first.code), null);

    const second = await reserveRoomSlot(db, 'creator_do_finish', 'qv_2');
    assert.ok(second.roomId);
    assert.deepEqual(second.replacedRoomIds, []);
  });
});
