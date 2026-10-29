# Brio

Brio is a live quiz platform with Arabic and English interfaces. Create quizzes online, then host them in the cloud or on a laptop over a local network. Players join from their phone browser using a room code or QR.

[Open Brio](https://brio-worker.fawzy-sukkar2005.workers.dev) · [Windows presenter download](https://brio-worker.fawzy-sukkar2005.workers.dev/local/)

## Quick start: LAN from source

Requires Node.js 24.11 or newer and pnpm. Prepare the project while online:

```powershell
pnpm install --frozen-lockfile
pnpm lan:build
pnpm lan:start
```

Open `http://localhost:3210/local/` on the presenter laptop. Players join through the laptop's LAN address on the same network. To use your own quiz, download its LAN package from the online editor and import it in the local dashboard.

For presenters using the Windows installer, Node.js is bundled; no developer setup is required.

## Technology

TypeScript and pnpm workspaces share contracts and game rules between both runtimes. Next.js, React and Tailwind CSS provide the UI; Cloudflare Workers, Durable Objects and D1 run the cloud service. Node.js, WebSocket and SQLite provide LAN hosting. C#/WinForms packages the Windows presenter. See [Architecture](docs/architecture.md) for the role of each technology and the reasons behind these choices.

## Documentation

- [Development](docs/development.md): setup, environment variables, commands and checks.
- [Architecture](docs/architecture.md): technology choices, module boundaries and game behavior.
- [Operations](docs/operations.md): event setup, data, Windows packaging and cloud deployment.
- [Project status](docs/status.md): recorded release and remaining acceptance work.
- [LinkedIn draft](docs/linkedin.md): Arabic post.

Run `pnpm quality` for the full verification pipeline. The Windows release is an unsigned pilot; physical-phone and venue-network acceptance remains pending.
