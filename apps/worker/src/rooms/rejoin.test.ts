import test from 'node:test';
import assert from 'node:assert/strict';
import roomPlayerRoutes from '../routes/room-players';
import { GameRoomDO } from '../durable-objects/GameRoomDO';
import { reserveRoomSlot } from '../repositories/room-directory.repository';
import { createMockD1Database, createMockDoStorage, mockQuizSnapshot } from './testing-fixtures';

test('repeated public joins reuse the cookie seat, including after wake, while explicit leave releases it', async () => {
  const db = createMockD1Database();
  const reservation = await reserveRoomSlot(db, 'owner', 'quiz');
  const storage = createMockDoStorage();
  const ctx = {
    id: { toString: () => reservation.roomId },
    storage,
    getWebSockets: () => [],
    acceptWebSocket: () => {},
    getTags: () => [],
  };
  let room = new GameRoomDO(ctx, { DB: db } as any);
  await room.initQuizSnapshot(mockQuizSnapshot);
  const env = {
    DB: db,
    GAME_ROOM: { idFromName: (id: string) => id, get: () => ({ fetch: (req: Request) => room.fetch(req) }) },
  } as any;
  const url = `https://brio.test/api/rooms/${reservation.roomId}`;
  const session = async (cookie = '') => {
    const response = await roomPlayerRoutes.fetch(
      new Request(url + '/session', {
        headers: { Cookie: cookie },
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return ((await response.json()) as any).player;
  };
  assert.equal(await session(), null);
  assert.equal(await session(`brio_player_${reservation.roomId}=${crypto.randomUUID()}`), null);
  assert.equal(room.state.players.size, 0);
  const join = async (cookie = '', nickname = 'Original', avatarId = 'avatar_1') => {
    const response = await roomPlayerRoutes.fetch(
      new Request(url + '/join', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatarId }),
      }),
      env,
    );
    assert.equal(response.status, 201);
    return {
      player: (await response.json()) as any,
      cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    };
  };
  const first = await join();
  const id = first.player.playerId;
  assert.deepEqual(await session(first.cookie), {
    playerId: id,
    nickname: 'Original',
    avatarId: 'avatar_1',
    sessionToken: first.player.sessionToken,
  });
  const generation = room.state.players.get(id)!.connectionGeneration;
  await session(first.cookie);
  assert.equal(room.state.players.get(id)!.connectionGeneration, generation);
  assert.equal(await session(first.cookie.replace(reservation.roomId, 'another-room')), null);
  room.state.players.get(id)!.score = 700;
  storage.sql.exec('UPDATE players SET score = ? WHERE player_id = ?', 700, id);
  for (let i = 0; i < 100; i++) {
    const again = await join(first.cookie, 'Different', 'avatar_2');
    assert.equal(again.player.playerId, id);
    assert.equal(again.player.nickname, 'Original');
    assert.equal(again.player.avatarId, 'avatar_1');
    assert.equal(again.player.sessionToken, first.player.sessionToken);
    assert.equal(room.state.players.size, 1);
    assert.equal(room.state.players.get(id)!.score, 700);
  }
  assert.equal(Array.from(storage.sql.exec('SELECT COUNT(*) AS count FROM players'))[0].count, 1);
  assert.equal(
    Array.from(storage.sql.exec('SELECT COUNT(*) AS count FROM participation_history'))[0].count,
    1,
  );

  room = new GameRoomDO(ctx, { DB: db } as any);
  assert.equal((await session(first.cookie)).playerId, id);
  assert.equal(room.state.players.get(id)!.score, 700);
  const resumed = await join(first.cookie);
  assert.equal(resumed.player.playerId, id);
  assert.equal(room.state.players.get(id)!.score, 700);
  const second = await join();
  assert.notEqual(second.player.playerId, id);
  assert.equal(room.state.players.size, 2);

  const leave = await roomPlayerRoutes.fetch(
    new Request(url + '/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: id, sessionToken: first.player.sessionToken }),
    }),
    env,
  );
  assert.equal(leave.status, 200);
  assert.equal(room.state.players.has(id), false);
  assert.equal(await session(first.cookie), null);
  const fresh = await join(first.cookie, 'New player');
  assert.notEqual(fresh.player.playerId, id);
  assert.equal(fresh.player.nickname, 'New player');
  assert.equal(room.state.players.size, 2);
  room.state.phase = 'FINISHED';
  assert.equal(await session(fresh.cookie), null);
});
