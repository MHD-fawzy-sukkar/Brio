import test from 'node:test';
import assert from 'node:assert/strict';
import { BrioRoomSocket } from './socket';

test('room socket repairs missed transitions, adjusts clock drift, and reconnects silent connections', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 100000 });
  class FakeSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static instances: FakeSocket[] = [];
    readyState = 0;
    sent: any[] = [];
    onopen?: () => void;
    onclose?: () => void;
    onerror?: () => void;
    onmessage?: (event: { data: string }) => void;
    constructor(_url: string) { FakeSocket.instances.push(this); }
    send(message: string) { this.sent.push(JSON.parse(message)); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(message: any) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(windowEvents, {
    location: { protocol: 'https:', host: 'brio.test' }
  }) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentEvents });
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeSocket });
  const socket = new BrioRoomSocket('room1', 'player', 'p1');
  t.after(() => {
    socket.close();
    for (const [key, descriptor] of [['window', originalWindow], ['document', originalDocument], ['WebSocket', originalSocket]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const snapshots: any[] = [];
  socket.onSnapshot((snapshot) => snapshots.push(snapshot));
  socket.connect();
  const ws = FakeSocket.instances[0];
  ws.open();
  assert.equal(ws.sent[0].type, 'room.sync');
  t.mock.timers.tick(200);
  ws.receive({ type: 'room.snapshot', stateVersion: 2, serverNow: 110100, t0: 100000,
    payload: { phase: 'COUNTDOWN' } });
  assert.equal(snapshots[0].serverNow, 110200); // midpoint sample corrects a ten-second clock skew
  ws.receive({ type: 'room.snapshot', stateVersion: 1, payload: { phase: 'LOBBY' } });
  assert.equal(snapshots.length, 1);
  t.mock.timers.tick(5000);
  assert.equal(ws.sent.at(-1).type, 'room.sync');
  ws.receive({ type: 'room.snapshot', stateVersion: 3, serverNow: 115200,
    payload: { phase: 'QUESTION' } });
  assert.equal(snapshots.at(-1).phase, 'QUESTION');
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  assert.equal(ws.sent.at(-1).payload.t0, Date.now());
  const answer = socket.submitAnswer('round1', 'sub1', { optionId: 'a' });
  const rejection = assert.rejects(answer, /تأكيد الإجابة/);
  t.mock.timers.tick(10000);
  await rejection;
  t.mock.timers.tick(10000);
  assert.equal(ws.readyState, 3);
  t.mock.timers.tick(1000);
  assert.equal(FakeSocket.instances.length, 2);
  const reconnected = FakeSocket.instances[1];
  reconnected.open();
  reconnected.receive({ type: 'room.snapshot', stateVersion: 8, serverNow: Date.now() + 10000,
    payload: { phase: 'FINISHED' } });
  assert.equal(snapshots.at(-1).phase, 'FINISHED');
  ws.onclose?.(); // late events from the old connection cannot clear the new one
  assert.equal(reconnected.readyState, 1);
  socket.close();
  t.mock.timers.tick(30000);
  assert.equal(FakeSocket.instances.length, 2);
});
