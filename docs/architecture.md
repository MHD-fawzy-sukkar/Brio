# Architecture

Brio uses one game engine with two hosting adapters: Cloudflare for online play and Node.js for LAN play. The same static web UI supports authoring, hosting and playing in Arabic or English, including RTL/LTR switching.

## Technology choices

| Technology                       | Role and reason                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + pnpm workspaces     | Share protocol types, validation and game rules across applications without maintaining separate cloud and LAN implementations.                           |
| Next.js + React                  | Organize routes and interactive screens, then export static files that either runtime can serve. No Next.js application server is required in production. |
| Tailwind CSS + local CSS         | Build responsive layouts, shared visual tokens and lightweight motion without a large animation framework.                                                |
| Cloudflare Workers + Hono        | Serve static assets and route cloud API requests from one origin, simplifying cookies and WebSocket connections.                                          |
| Durable Objects + SQLite storage | Give each cloud room a single authority for state, connections, persisted answers and scheduled transitions.                                              |
| D1                               | Store creator accounts, authored quizzes, published versions, room directory entries and archived results outside the live answer path.                   |
| Cloudinary                       | Handle cloud image uploads and delivery; LAN exports download the required images before an event.                                                        |
| Node.js + `ws` + SQLite          | Serve pages, images and live connections locally, retaining data without requiring external services during play.                                         |
| C# + WinForms                    | Provide a native Windows launcher, installer and uninstaller, with bundled Node.js so presenters can start the server without a terminal.                 |
| Zod                              | Validate untrusted HTTP, socket and imported quiz data at runtime; TypeScript alone cannot validate incoming data.                                        |

The online service still needs Internet access. Browser caching helps with repeated downloads, while LAN makes both the server and prepared content available on the local network. An event chooses its hosting mode; there is no automatic cloud-to-LAN failover.

## Repository map

| Path                       | Responsibility                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                 | Static UI: `app` route entries, `features` controllers/views, shared `components`, `services`, hooks, translations and styles |
| `apps/worker`              | Cloud API routes, authentication, D1 repositories and Durable Object room adapters                                            |
| `apps/local`               | LAN HTTP/WebSocket transport, SQLite storage and quiz/media import                                                            |
| `apps/desktop`             | Windows presenter, setup, uninstaller and native smoke harness                                                                |
| `packages/contracts`       | Shared DTOs, Zod schemas and live protocol                                                                                    |
| `packages/game-core`       | Pure state transitions, timing, scoring, normalization and recipient-specific serializers                                     |
| `scripts` and `benchmarks` | Build/package commands, verification and the historical performance fixture                                                   |

Web imports contracts, while Worker and LAN import contracts plus game-core. The engine stays independent of browser, HTTP and Cloudflare APIs. Repositories do not depend on route handlers, and feature modules do not import page entries.

## Live game behavior

The host opens a room, players join, and the server advances through countdown, questions, statistics, ranking and final results. Clients render server timestamps rather than deciding when answers close. Reconnecting clients request the current state instead of replaying missed screens.

- Persist accepted answers before acknowledging them. Repeated submissions must not award points twice.
- Keep correct answers and host-only data out of player payloads. Published quiz content is frozen for a room.
- Slow players, unavailable images and media readiness reports must not postpone other players' questions.
- Current scoring includes a server-timed speed component: a correct answer retains at least half its base value, with the rest based on response time. Standard/double base values are 1,000/2,000; wrong answers and zero-point questions earn zero.
- Equal scores share competition rank, such as 1, 1, 3. Join order only stabilizes their display order.

See the [protocol](../packages/contracts/src/protocol.ts), [engine](../packages/game-core/src/engine/) and [scoring rules](../packages/game-core/src/scoring/rules.ts) for exact behavior.

## Images, caching and security

The shared image prefetcher limits concurrent downloads to two and its compressed memory cache to 8 MiB. It prioritizes upcoming images and checks decoding before reporting readiness. Essential-image failure can block answering on the affected device while the global timer continues.

The service worker caches application assets; authentication, creator APIs and live state must remain uncached. LAN serves fonts, artwork and imported images locally and works without relying on service workers on ordinary LAN HTTP.

Cloud creator login uses Google token verification; ownership and room permissions are enforced on the server. LAN presenter access bootstraps from the same laptop through loopback. Imported quiz packages contain private answer keys and belong on the presenter device only.

Runtime artwork in `apps/web/public/` is used by the UI, service worker and Windows packaging. The performance fixture in `benchmarks/` is also an active script input.
