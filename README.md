# Brio

Arabic live quizzes with a static Next.js frontend, a Cloudflare Worker/Durable Object cloud runtime, and an optional Windows-hosted LAN runtime sharing the same TypeScript game core.

## LAN rehearsal

Requires Node.js 24.11+ and pnpm. Prepare once while online:

```powershell
pnpm install --frozen-lockfile
pnpm lan:build
pnpm lan:start
```

After preparation, `Start-LAN.cmd` starts the local server. Open `http://localhost:3210/local/` on the presenter laptop to open the presenter dashboard automatically, without a password. A demo quiz is included. Players use the LAN address/QR shown in the host lobby, on the same Wi-Fi; they install nothing.

For real quizzes, download the LAN package from the online builder and import it on the presenter laptop. The export feature must first be deployed to the online application. No cloud deployment is performed by LAN build/start commands.

See [LAN setup, architecture, tests and pending acceptance](docs/14-LAN.md). Physical phone/WAN-disconnected and sustained venue load tests remain required.

## Repository

- `apps/web`: shared creator, host and player UI.
- `apps/worker`: cloud API, D1 authoring and Durable Object rooms.
- `apps/local`: local HTTP/WebSocket server, SQLite and quiz/media import.
- `packages/contracts`: DTOs and input schemas.
- `packages/game-core`: authoritative rules, scoring and public serializers.
- `backend`: retained legacy .NET implementation.

Canonical documents start at [Project Structure](docs/Project-Structure.md) and [Project Memory](docs/5-Project-Memory.md).

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. LAN integration tests bind local HTTP/WebSocket ports.
