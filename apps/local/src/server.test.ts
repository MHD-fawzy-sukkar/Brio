import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { WebSocket } from 'ws';
import { createLanServer } from './server';
import { png, fixtureBundle } from './testing/fixtures';
import { runAdditionalRoomChecks } from './testing/room-checks';
test('LAN host and three players finish locally; auth, durable receipts, reconnect and restart remain correct', async (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'brio-lan-test-'));
  const webRoot = resolve(directory, 'web');
  mkdirSync(resolve(webRoot, 'local'), { recursive: true });
  writeFileSync(
    resolve(webRoot, 'local/index.html'),
    '<html><meta name="brio-runtime-lan" content="1">LAN</html>',
  );
  mkdirSync(resolve(webRoot, 'join-game'));
  writeFileSync(resolve(webRoot, 'join-game/index.html'), '<html>Join game</html>');
  let time = 100000;
  const config = {
    database: resolve(directory, 'test.sqlite'),
    webRoot,
    port: 0,
    bind: '127.0.0.1',
    now: () => time,
  };
  let app = createLanServer(config);
  let port = await app.listen();
  let origin = `http://127.0.0.1:${port}`;
  const sockets: WebSocket[] = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    await app.close();
    assert.ok(directory.startsWith(resolve(tmpdir()) + sep + 'brio-lan-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const request = (path: string, cookie = '', body?: unknown, method?: string) =>
    fetch(origin + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async () => {
    const res = await request('/api/local/login', '', {});
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie')!.split(';')[0];
  };
  let hostCookie = await login();
  const noOrigin = await fetch(origin + '/api/local/login', { method: 'POST' });
  assert.equal(noOrigin.status, 403);
  const foreignLogin = await fetch(origin + '/api/local/login', {
    method: 'POST',
    headers: { Origin: 'https://evil.invalid' },
  });
  assert.equal(foreignLogin.status, 403);
  // A LAN URL never grants presenter privileges, even when opened on this machine.
  if (app.addresses[0]) {
    const lanOrigin = `http://${app.addresses[0]}:${port}`;
    const lanLogin = await fetch(origin + '/api/local/login', {
      method: 'POST',
      headers: { Host: `${app.addresses[0]}:${port}`, Origin: lanOrigin },
    });
    assert.equal(lanLogin.status, 403);
    assert.equal(lanLogin.headers.get('set-cookie'), null);
  }
  assert.equal((await request('/api/local/import', '', fixtureBundle())).status, 401);
  assert.equal((await request('/api/local/import', hostCookie, fixtureBundle())).status, 201);
  const { roomId, code } = (await (
    await request('/api/rooms', hostCookie, { quizId: 'quiz' })
  ).json()) as any;
  const dashboard = (await (await request('/api/local/info', hostCookie)).json()) as any;
  assert.equal(dashboard.rooms.find((room: any) => room.roomId === roomId).quizId, 'quiz');
  assert.equal(((await (await request(`/api/rooms/by-code/${code}`)).json()) as any).roomId, roomId);
  assert.equal((await request(`/api/rooms/${roomId}/snapshot`)).status, 401);
  assert.deepEqual(await (await request(`/api/rooms/${roomId}/session`)).json(), { player: null });
  const players = await Promise.all(
    ['one', 'two', 'three'].map(async (nickname) => {
      const res = await request(`/api/rooms/${roomId}/join`, '', { nickname, avatarId: 'avatar_1' });
      assert.equal(res.status, 201);
      return { ...((await res.json()) as any), cookie: res.headers.get('set-cookie')!.split(';')[0] };
    }),
  );
  assert.equal(app.store.load(roomId)!.state.players.size, 3);
  const existingSession = (await (
    await request(`/api/rooms/${roomId}/session`, players[0].cookie)
  ).json()) as any;
  assert.deepEqual(existingSession.player, {
    playerId: players[0].playerId,
    nickname: 'one',
    avatarId: 'avatar_1',
    sessionToken: 'cookie',
  });
  assert.deepEqual(
    await (await request(`/api/rooms/${roomId}/session`, 'brio_player_invalid=invalid')).json(),
    { player: null },
  );
  assert.equal(app.store.load(roomId)!.state.players.size, 3);
  const manifest = (await (await request(`/api/rooms/${roomId}/media`, players[0].cookie)).json()) as any[];
  assert.equal(JSON.stringify(manifest).includes('PRIVATE FUTURE'), false);
  assert.deepEqual(Buffer.from(await (await request(manifest[0].url)).arrayBuffer()), png);
  const resumed = (await (
    await request(`/api/rooms/${roomId}/join`, players[0].cookie, { nickname: 'again' })
  ).json()) as any;
  assert.equal(resumed.playerId, players[0].playerId);
  assert.equal(app.store.load(roomId)!.state.players.size, 3);
  async function connect(cookie: string, role: string, playerId = '', targetRoomId = roomId) {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws/rooms/${targetRoomId}?role=${role}&playerId=${playerId}`,
      { headers: { Cookie: cookie, Origin: origin } },
    );
    const messages: any[] = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    sockets.push(ws);
    await new Promise<void>((ok, fail) => {
      ws.once('open', ok);
      ws.once('error', fail);
    });
    return { ws, messages };
  }
  async function wait(messages: any[], predicate: (msg: any) => boolean) {
    for (let i = 0; i < 300; i++) {
      const found = messages.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.fail('Timed out waiting for message');
  }
  const host = await connect(hostCookie, 'host');
  const clients = await Promise.all(players.map((p) => connect(p.cookie, 'player', p.playerId)));
  clients[0].ws.send(JSON.stringify({ type: 'host.start' }));
  await wait(clients[0].messages, (m) => m.type === 'error');
  assert.equal(app.store.load(roomId)!.state.phase, 'LOBBY');
  host.ws.send(JSON.stringify({ type: 'host.start' }));
  await wait(host.messages, (m) => m.payload?.phase === 'COUNTDOWN');
  time += 3000;
  const first = (await (await request(`/api/rooms/${roomId}/snapshot`, players[0].cookie)).json()) as any;
  assert.equal(first.phase, 'QUESTION');
  assert.equal(JSON.stringify(first).includes('isCorrect'), false);
  assert.equal(JSON.stringify(first).includes('PRIVATE FUTURE'), false);
  const roundId = first.roundId;
  const answer = (id: number, submissionId: string, optionId = 'a') => ({
    type: 'answer.submit',
    requestId: submissionId,
    payload: { roundId, submissionId, optionId, playerId: players[id].playerId },
  });
  // Simulated SQLite write failure: neither ACK nor speculative answer survives.
  const save = app.store.save.bind(app.store);
  app.store.save = () => {
    throw new Error('Injected disk failure');
  };
  clients[0].ws.send(JSON.stringify(answer(0, 'failed')));
  await wait(
    clients[0].messages,
    (m) => m.type === 'error' && clients[0].messages.filter((x) => x.type === 'error').length >= 2,
  );
  assert.equal(app.store.load(roomId)!.state.answers.size, 0);
  assert.equal(
    clients[0].messages.some((m) => m.type === 'answer.receipt'),
    false,
  );
  app.store.save = save;
  for (let i = 0; i < 3; i++) clients[i].ws.send(JSON.stringify(answer(i, `answer-${i}`)));
  await Promise.all(
    clients.map((c, i) =>
      wait(c.messages, (m) => m.type === 'answer.receipt' && m.requestId === `answer-${i}`),
    ),
  );
  assert.equal(app.store.load(roomId)!.state.answers.size, 3);
  // Retry the same durable answer, then attempt to change it.
  clients[0].ws.send(JSON.stringify({ ...answer(0, 'answer-0'), requestId: 'retry' }));
  await wait(clients[0].messages, (m) => m.type === 'answer.receipt' && m.requestId === 'retry');
  clients[0].ws.send(JSON.stringify({ ...answer(0, 'answer-0', 'b'), requestId: 'conflict' }));
  await wait(clients[0].messages, (m) => m.type === 'answer.rejected' && m.requestId === 'conflict');
  const replacement = await connect(players[0].cookie, 'player', players[0].playerId);
  const restored = await wait(replacement.messages, (m) => m.type === 'room.snapshot');
  assert.ok(restored.payload.ownReceipt);
  assert.equal(restored.payload.ownReceipt.isCorrect, undefined);
  time += 10000;
  const stats = (await (await request(`/api/rooms/${roomId}/snapshot`, hostCookie)).json()) as any;
  assert.equal(stats.phase, 'STATS');
  assert.equal(stats.leaderboard[0].score, 1000);
  await request(`/api/rooms/${roomId}/snapshot`, hostCookie);
  assert.equal(app.store.load(roomId)!.state.players.get(players[0].playerId)!.score, 1000);
  time += 3000;
  await request(`/api/rooms/${roomId}/snapshot`, hostCookie);
  time += 5000;
  await request(`/api/rooms/${roomId}/snapshot`, hostCookie);
  time += 10000;
  await request(`/api/rooms/${roomId}/snapshot`, hostCookie);
  time += 3000;
  const final = (await (await request(`/api/rooms/${roomId}/snapshot`, players[0].cookie)).json()) as any;
  assert.equal(final.phase, 'FINISHED');
  assert.equal(final.ownScore, 1000);
  assert.equal(final.ownRank, 1);
  assert.deepEqual(await (await request(`/api/rooms/${roomId}/session`, players[0].cookie)).json(), {
    player: null,
  });
  await app.close();
  app = createLanServer(config);
  port = await app.listen();
  origin = `http://127.0.0.1:${port}`;
  hostCookie = await login();
  const persisted = (await (await request(`/api/rooms/${roomId}/snapshot`, players[0].cookie)).json()) as any;
  assert.equal(persisted.ownScore, 1000);
  assert.equal(persisted.phase, 'FINISHED');
  assert.equal((await request(`/api/rooms/${roomId}/join`, '', { nickname: 'late' })).status, 409);
  const crossOrigin = await fetch(origin + '/api/rooms', {
    method: 'POST',
    headers: { Origin: 'https://evil.invalid', Cookie: hostCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId: 'quiz' }),
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(
    (await request('/api/no-such-route')).headers.get('content-type')?.includes('application/json'),
    true,
  );
  assert.equal((await request('/local/')).status, 200);
  const joinRedirect = await fetch(origin + '/join-game?pin=123456', { redirect: 'manual' });
  assert.equal(joinRedirect.status, 308);
  assert.equal(joinRedirect.headers.get('location'), '/join-game/?pin=123456');
  assert.equal((await request('/join-game')).status, 200);
  assert.equal((await request('/join-game/')).status, 200);

  await runAdditionalRoomChecks(t, { request, hostCookie, app, manifest });

  await t.test(
    'a disconnected player and presenter do not stop the deadline; rejoining restores identity and score',
    async () => {
      const room = (await (await request('/api/rooms', hostCookie, { quizId: 'quiz' })).json()) as any;
      const joined = await request(`/api/rooms/${room.roomId}/join`, '', { nickname: 'returning' });
      const player = (await joined.json()) as any;
      const playerSession = joined.headers.get('set-cookie')!.split(';')[0];
      const controller = await connect(hostCookie, 'host', '', room.roomId);
      const participant = await connect(playerSession, 'player', player.playerId, room.roomId);
      const observerJoin = await request(`/api/rooms/${room.roomId}/join`, '', { nickname: 'staying' });
      const observer = (await observerJoin.json()) as any;
      const observerSocket = await connect(
        observerJoin.headers.get('set-cookie')!.split(';')[0],
        'player',
        observer.playerId,
        room.roomId,
      );
      controller.ws.send(JSON.stringify({ type: 'host.start' }));
      await wait(participant.messages, (m) => m.payload?.phase === 'COUNTDOWN');
      time += 3000;
      const question = (await (
        await request(`/api/rooms/${room.roomId}/snapshot`, hostCookie)
      ).json()) as any;
      participant.ws.send(
        JSON.stringify({
          type: 'answer.submit',
          requestId: 'before-disconnect',
          payload: { roundId: question.roundId, submissionId: 'before-disconnect', optionId: 'a' },
        }),
      );
      await wait(participant.messages, (m) => m.type === 'answer.receipt');
      participant.ws.terminate();
      controller.ws.terminate();
      // Schedule a short real timer with the injected clock, then advance only that clock.
      // No request drives the transition: the remaining player's socket must receive STATS.
      const saved = app.store.load(room.roomId)!;
      saved.state.activeRound!.endsAt = time + 40;
      app.store.save(saved);
      await request(`/api/rooms/${room.roomId}/snapshot`, playerSession);
      time += 40;
      await wait(observerSocket.messages, (m) => m.payload?.phase === 'STATS');
      const resumed = (await (
        await request(`/api/rooms/${room.roomId}/join`, playerSession, { nickname: 'changed' })
      ).json()) as any;
      assert.equal(resumed.playerId, player.playerId);
      assert.equal(resumed.nickname, 'returning');
      const reconnected = await connect(playerSession, 'player', player.playerId, room.roomId);
      const state = await wait(reconnected.messages, (m) => m.payload?.phase === 'STATS');
      assert.equal(state.payload.ownScore, 1000);
      assert.equal(state.payload.ownReceipt.submissionId, 'before-disconnect');
      assert.equal(app.store.load(room.roomId)!.state.players.size, 2);
      assert.equal((await request(`/api/rooms/${room.roomId}`, hostCookie, undefined, 'DELETE')).status, 200);
      reconnected.ws.terminate();
      observerSocket.ws.terminate();
    },
  );

  await t.test(
    '150 real localhost WebSocket clients receive durable burst receipts with no duplicate scores',
    async (sub) => {
      const swarm = (await (await request('/api/rooms', hostCookie, { quizId: 'quiz' })).json()) as any;
      const participants = await Promise.all(
        Array.from({ length: 150 }, async (_, i) => {
          const res = await request(`/api/rooms/${swarm.roomId}/join`, '', { nickname: `player-${i}` });
          assert.equal(res.status, 201);
          return { ...((await res.json()) as any), cookie: res.headers.get('set-cookie')!.split(';')[0] };
        }),
      );
      assert.equal(app.store.load(swarm.roomId)!.state.players.size, 150);
      const controller = await connect(hostCookie, 'host', '', swarm.roomId);
      const clients = await Promise.all(
        participants.map((p) => connect(p.cookie, 'player', p.playerId, swarm.roomId)),
      );
      controller.ws.send(JSON.stringify({ type: 'host.start' }));
      await wait(controller.messages, (m) => m.payload?.phase === 'COUNTDOWN');
      time += 3000;
      const question = (await (
        await request(`/api/rooms/${swarm.roomId}/snapshot`, hostCookie)
      ).json()) as any;
      const start = performance.now();
      const latencies: number[] = [];
      const completed = clients.map((client, i) => {
        const submitted = performance.now();
        client.ws.send(
          JSON.stringify({
            type: 'answer.submit',
            requestId: `burst-${i}`,
            payload: { roundId: question.roundId, submissionId: `burst-${i}`, optionId: 'a' },
          }),
        );
        return wait(client.messages, (m) => m.type === 'answer.receipt' && m.requestId === `burst-${i}`).then(
          () => latencies.push(performance.now() - submitted),
        );
      });
      await Promise.all(completed);
      latencies.sort((a, b) => a - b);
      sub.diagnostic(
        `150-client loopback burst: total=${Math.round(performance.now() - start)}ms, receipt p95=${Math.round(latencies[Math.floor(latencies.length * 0.95)])}ms (includes harness scheduling; no Wi-Fi/browser simulation).`,
      );
      assert.equal(app.store.load(swarm.roomId)!.state.answers.size, 150);
      time += 10000;
      await request(`/api/rooms/${swarm.roomId}/snapshot`, hostCookie);
      assert.ok([...app.store.load(swarm.roomId)!.state.players.values()].every((p) => p.score === 1000));
      // Second question: exact endsAt excludes new submissions, even when its timer has not fired.
      time += 3000;
      await request(`/api/rooms/${swarm.roomId}/snapshot`, hostCookie);
      time += 5000;
      const second = (await (await request(`/api/rooms/${swarm.roomId}/snapshot`, hostCookie)).json()) as any;
      time += 10000;
      clients[0].ws.send(
        JSON.stringify({
          type: 'answer.submit',
          requestId: 'late',
          payload: { roundId: second.roundId, submissionId: 'late', optionId: 'a' },
        }),
      );
      await wait(clients[0].messages, (m) => m.type === 'answer.rejected' && m.requestId === 'late');
      time += 3000;
      await request(`/api/rooms/${swarm.roomId}/snapshot`, hostCookie);
      assert.equal(app.store.load(swarm.roomId)!.state.phase, 'FINISHED');
      assert.equal(app.store.load(swarm.roomId)!.state.answers.size, 150);
      for (const client of clients) client.ws.terminate();
      controller.ws.terminate();
    },
  );

  await t.test(
    'restart during an overdue question pauses for explicit recovery instead of silently losing the room',
    async () => {
      const next = (await (await request('/api/rooms', hostCookie, { quizId: 'quiz' })).json()) as any;
      const controller = await connect(hostCookie, 'host', '', next.roomId);
      controller.ws.send(JSON.stringify({ type: 'host.start' }));
      await wait(controller.messages, (m) => m.payload?.phase === 'COUNTDOWN');
      time += 3000;
      await request(`/api/rooms/${next.roomId}/snapshot`, hostCookie);
      await app.close();
      time += 16000;
      app = createLanServer(config);
      port = await app.listen();
      origin = `http://127.0.0.1:${port}`;
      hostCookie = await login();
      assert.equal(app.store.load(next.roomId)!.state.phase, 'RECOVERY_PAUSED');
      const recovered = await connect(hostCookie, 'host', '', next.roomId);
      recovered.ws.send(JSON.stringify({ type: 'host.recover', payload: { action: 'void_and_replay' } }));
      await wait(recovered.messages, (m) => m.payload?.phase === 'QUESTION');
      assert.equal(app.store.load(next.roomId)!.state.phase, 'QUESTION');
    },
  );
});
