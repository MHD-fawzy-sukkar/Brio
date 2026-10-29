import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';
import { RequestLimiterDO } from '../durable-objects/RequestLimiterDO';
import { createMockDoStorage } from '../rooms/testing-fixtures';

function fixture() {
  let now = 0;
  let reads = 0;
  const limiter = (maximum: number, period: number) => {
    const buckets = new Map<string, { start: number; count: number }>();
    return {
      limit: async ({ key }: { key: string }) => {
        let bucket = buckets.get(key);
        if (!bucket || now - bucket.start >= period) buckets.set(key, (bucket = { start: now, count: 0 }));
        return { success: ++bucket.count <= maximum };
      },
    };
  };
  const env = {
    CLIENT_LIMITER: limiter(30, 10000),
    ENTRY_LIMITER: limiter(1200, 60000),
    DB: {
      prepare: () => {
        reads++;
        return { bind: () => ({ first: async () => null }) };
      },
    },
  } as any;
  const request = (client: string) =>
    app.fetch(
      new Request('https://brio.test/api/rooms/by-code/123456', {
        headers: { Cookie: `brio_client=${client}`, 'CF-Connecting-IP': '192.0.2.1' },
      }),
      env,
    );
  return {
    request,
    env,
    get reads() {
      return reads;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test('100 requests from one browser stop at 30 before touching D1 and recover after the cooldown', async () => {
  const f = fixture();
  const client = crypto.randomUUID();
  const responses = await Promise.all(Array.from({ length: 100 }, () => f.request(client)));
  assert.equal(responses.filter((r) => r.status === 404).length, 30);
  assert.equal(responses.filter((r) => r.status === 429).length, 70);
  assert.equal(f.reads, 30);
  const blocked = responses.find((r) => r.status === 429)!;
  assert.equal(blocked.headers.get('Retry-After'), '10');
  assert.equal(((await blocked.json()) as any).code, 'rate_limit_exceeded');
  f.advance(10000);
  assert.equal((await f.request(client)).status, 404);
  assert.equal(f.reads, 31);
});

test('the durable budget blocks 100 requests even when the edge counters allow every request', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  const f = fixture();
  const storage = createMockDoStorage();
  let writes = 0;
  const original = storage.sql.exec;
  storage.sql.exec = (query, ...args) => {
    if (query.startsWith('INSERT')) writes++;
    return original(query, ...args);
  };
  let counter = new RequestLimiterDO({ storage });
  f.env.CLIENT_LIMITER = { limit: async () => ({ success: true }) };
  f.env.REQUEST_LIMITER = { idFromName: (id: string) => id, get: () => ({ fetch: () => counter.fetch() }) };
  const client = crypto.randomUUID();
  const responses = await Promise.all(Array.from({ length: 100 }, () => f.request(client)));
  assert.equal(responses.filter((r) => r.status === 429).length, 70);
  assert.equal(f.reads, 30);
  assert.equal(writes, 30);
  counter = new RequestLimiterDO({ storage });
  assert.equal((await f.request(client)).status, 429);
  t.mock.timers.tick(10000);
  assert.equal((await f.request(client)).status, 404);
  t.mock.timers.tick(60000);
  await counter.alarm();
  assert.equal(Array.from(storage.sql.exec('SELECT * FROM request_budget')).length, 0);
  assert.equal((await f.request(client)).status, 404);
});

test('200 browsers behind one Wi-Fi address have independent burst budgets', async () => {
  const f = fixture();
  const responses = await Promise.all(Array.from({ length: 200 }, () => f.request(crypto.randomUUID())));
  assert.equal(
    responses.every((r) => r.status === 404),
    true,
  );
  assert.equal(f.reads, 200);
  const bootstrap = await app.fetch(new Request('https://brio.test/api/health'), f.env);
  assert.match(bootstrap.headers.get('Set-Cookie')!, /brio_client=.*HttpOnly; SameSite=Strict/);
});

test('the shared IP ceiling remains effective when a caller rotates client cookies', async () => {
  const f = fixture();
  for (let i = 0; i < 1200; i++) assert.equal((await f.request(crypto.randomUUID())).status, 404);
  const blocked = await f.request(crypto.randomUUID());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '60');
  assert.equal(f.reads, 1200);
});

test('client-cookie bootstrapping survives auth cookies and stricter auth/upload limits still run', async () => {
  const f = fixture();
  const logout = await app.fetch(
    new Request('https://brio.test/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://brio.test' },
    }),
    f.env,
  );
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie')!, /brio_client=/);
  let auth = 0;
  let upload = 0;
  f.env.AUTH_LIMITER = {
    limit: async () => {
      auth++;
      return { success: false };
    },
  };
  f.env.UPLOAD_LIMITER = {
    limit: async () => {
      upload++;
      return { success: false };
    },
  };
  for (const path of ['/api/auth/google', '/api/media/signature']) {
    const response = await app.fetch(
      new Request('https://brio.test' + path, {
        method: 'POST',
        headers: { Origin: 'https://brio.test' },
      }),
      f.env,
    );
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
  }
  assert.equal(auth, 1);
  assert.equal(upload, 1);
});
