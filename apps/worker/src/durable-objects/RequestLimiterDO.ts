import type { SqlStorageLike } from '../rooms/room-storage';

interface LimiterContext {
  storage: {
    sql: SqlStorageLike;
    setAlarm(time: number): Promise<void>;
  };
}

/** One durable counter per browser, shared across Cloudflare locations. */
export class RequestLimiterDO {
  private started = 0;
  private count = 0;
  constructor(private readonly ctx: LimiterContext) {
    this.initialize();
  }
  private initialize() {
    const sql = this.ctx.storage.sql;
    sql.exec(
      'CREATE TABLE IF NOT EXISTS request_budget (id INTEGER PRIMARY KEY, started INTEGER, count INTEGER)',
    );
    const row = Array.from(sql.exec('SELECT started, count FROM request_budget WHERE id=1'))[0] as
      | { started: number; count: number }
      | undefined;
    this.started = row?.started ?? 0;
    this.count = row?.count ?? 0;
  }
  async fetch(): Promise<Response> {
    const now = Date.now();
    const fresh = this.count === 0 || now - this.started >= 10000;
    if (fresh) {
      this.started = now;
      this.count = 0;
    }
    if (this.count >= 30)
      return Response.json({
        success: false,
        retryAfter: Math.max(1, Math.ceil((this.started + 10000 - now) / 1000)),
      });
    const next = this.count + 1;
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO request_budget(id,started,count) VALUES(1,?,?)',
      this.started,
      next,
    );
    this.count = next;
    if (fresh) await this.ctx.storage.setAlarm(now + 60000);
    return Response.json({ success: true });
  }
  async alarm() {
    if (Date.now() - this.started < 60000) {
      await this.ctx.storage.setAlarm(this.started + 60000);
      return;
    }
    this.ctx.storage.sql.exec('DELETE FROM request_budget');
    this.started = 0;
    this.count = 0;
  }
}
