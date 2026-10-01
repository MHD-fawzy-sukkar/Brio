export interface Env {
  DB: any;
  GAME_ROOM: any;
  ASSETS: any;
}

export class GameRoomDO {
  ctx: any;
  env: Env;

  constructor(ctx: any, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Minimal diagnostic WebSocket upgrade handler
    if (url.pathname.startsWith('/ws/')) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      // Socket upgrade handling in Worker runtime environment
      return new Response(null, {
        status: 101
      });
    }

    return new Response(JSON.stringify({ status: 'active', do: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async alarm(): Promise<void> {
    // Durable Object Alarm handler placeholder
  }

  async webSocketMessage(ws: any, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : {};
      if (data.type === 'clock.sample') {
        ws.send(JSON.stringify({
          v: 1,
          type: 'clock.sample',
          serverNow: Date.now(),
          payload: { t0: data.payload?.t0 }
        }));
      }
    } catch {
      ws.send(JSON.stringify({
        v: 1,
        type: 'error',
        serverNow: Date.now(),
        payload: { code: 'bad_request', detail: 'Invalid JSON message' }
      }));
    }
  }

  async webSocketClose(ws: any, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Socket close handler placeholder
  }
}
