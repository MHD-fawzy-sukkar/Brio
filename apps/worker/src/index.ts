import { app } from './app';
import type { Env } from './env';
export { GameRoomDO } from './durable-objects/GameRoomDO';
export { RequestLimiterDO } from './durable-objects/RequestLimiterDO';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }

      if (request.method === 'GET' && !url.pathname.includes('.')) {
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        const indexResponse = await env.ASSETS.fetch(indexRequest);
        if (indexResponse.status !== 404) {
          return indexResponse;
        }
      }
    }

    return app.fetch(request, env, ctx);
  },
};
