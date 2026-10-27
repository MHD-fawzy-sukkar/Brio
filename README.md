# Brio

Release preparation: [readiness review](docs/24-Production-Readiness.md), [operations and offline rehearsal](docs/25-Operations-and-Offline.md), [LinkedIn draft](docs/26-LinkedIn-Draft.md).

Arabic live quizzes with a static Next.js frontend, a Cloudflare Worker/Durable Object cloud runtime, and an optional Windows-hosted LAN runtime sharing the same TypeScript game core.

## LAN rehearsal

The cloud site's `/local/` page now provides the Windows presenter installer. See [Windows app, builds and verification](docs/29-Windows-Presenter-App.md). The ZIP below remains a developer/rehearsal option.

Windows x64 presenters can use the prepared portable ZIP: extract the entire archive, then double-click `Start-Brio.cmd` inside the extracted folder. Node and pnpm are included/not needed on the receiving PC. Players join by QR on the same Wi-Fi and download nothing. This unsigned package is for trusted private networks. Developers can create it with `pnpm lan:package` after `pnpm lan:build`, using Node 24.11.1 (its redistribution license is included). See [portable package and mobile rehearsal](docs/27-Portable-LAN-and-Mobile.md).

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

Canonical documents start at [Project Structure](docs/Project-Structure.md) and [Project Memory](docs/5-Project-Memory.md).

The header language button switches Arabic/English and RTL/LTR without reloading or resetting a game or draft. The preference is local to each browser/origin. See [language support and translation checks](docs/23-Languages.md).

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. LAN integration tests bind local HTTP/WebSocket ports.

## Maintainability and verification

Run `pnpm quality` for architecture limits, formatting, types, all tests, production export and a repeatable performance benchmark. `pnpm architecture` checks dependency boundaries and import cycles; `pnpm format` applies the pinned formatter. Production source files are limited to 300 lines, tests to 400.

See [current architecture and performance evidence](docs/22-Architecture-and-Performance.md). Historical .NET sources are in Git history, not the active working tree.
