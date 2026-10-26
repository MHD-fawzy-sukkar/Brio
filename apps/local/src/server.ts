import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLanRuntime, type LanServerOptions } from './runtime';
import { createLanHttpHandler } from './transport/http';
import { attachLanSockets } from './transport/sockets';

export function createLanServer(options: LanServerOptions) {
  const runtime = createLanRuntime(options);
  const { store, addresses, root, reconcile, timers, hostUpdateTimers, connections } = runtime;
  const server = createServer(
    createLanHttpHandler(runtime, (): number => (server.address() as { port: number }).port),
  );
  const sockets = attachLanSockets(server, runtime);
  return {
    server,
    store,
    addresses,
    async listen() {
      if (
        !existsSync(resolve(root, 'local/index.html')) ||
        !readFileSync(resolve(root, 'local/index.html'), 'utf8').includes('brio-runtime-lan')
      ) {
        throw new Error('LAN web build missing. Run pnpm lan:build first.');
      }
      await new Promise<void>((ok, fail) => {
        server.once('error', fail);
        server.listen(options.port ?? 3210, options.bind ?? '0.0.0.0', () => {
          server.off('error', fail);
          ok();
        });
      });
      for (const room of store.listRooms()) reconcile(room.id);
      return (server.address() as { port: number }).port;
    },
    async close() {
      for (const timer of timers.values()) clearTimeout(timer);
      for (const timer of hostUpdateTimers.values()) clearTimeout(timer);
      for (const c of connections) c.ws.terminate();
      sockets.close();
      await new Promise<void>((done) => server.close(() => done()));
      store.close();
    },
  };
}
