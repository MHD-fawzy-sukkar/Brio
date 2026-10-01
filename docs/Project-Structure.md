# Brio — Project Structure

Revision: 2026-09-30 / architecture v2. Status: implementation specification, NOT implemented code.

## Authority
Read SRS-Architecture.md, this file, Reference-Architecture-v2.md, 6-Implementation-Plan.md, 8-Protocol-and-Data.md, and 5-Project-Memory.md before changes. These v2 documents replace conflicting v1 .NET/Redis requirements. Preserve actual legacy source and history. The old Reference-Architecture.md was NOT supplied to the planner; inspect it in P0 and mark its conflicting instructions historical. Do not silently delete unrelated requirements.

## Selected target
TypeScript throughout the new application. Next.js static-export frontend; Cloudflare Worker API; SQLite-backed Durable Object per live room; D1 for authoring/accounts/results; Cloudinary for prepared images. No Redis, SQL Server, SignalR, SSR, or Next Server Actions in the new cloud runtime.

## Repository map
| Path | Responsibility |
| --- | --- |
| `backend/` | Existing .NET implementation: retained, excluded from new builds; reference until migration is verified |
| `apps/web/` | Next.js App Router, static export, mobile player and host UI |
| `apps/worker/` | HTTP API, authentication, Cloudflare bindings, room runtime |
| `apps/worker/src/http/` | Thin routing/HTTP validation and response mapping |
| `apps/worker/src/auth/` | Google token verification, creator sessions, CSRF, local development auth guard |
| `apps/worker/src/rooms/` | GameRoom Durable Object, alarm adapter, WebSocket adapter, SQL migrations |
| `apps/worker/src/repositories/` | D1 authoring repositories; no per-answer D1 access |
| `apps/worker/migrations/` | Versioned D1 SQL migrations |
| `apps/worker/wrangler.jsonc` | Worker, static-assets, D1, DO SQLite migration bindings |
| `apps/local/` | Reserved for P8 LAN runtime; do not implement in P1–P7 |
| `packages/contracts/` | Public DTOs, Zod schemas, protocol version; no answer keys |
| `packages/game-core/` | Pure rules, state transitions, scoring, normalization; server-only |
| `packages/game-core/src/ports/` | Small interfaces for clock, storage, scheduler, transport |
| `apps/web/src/features/creator/` | Login, quiz list, builder, image publishing |
| `apps/web/src/features/host/` | Lobby, controls, shared display, results |
| `apps/web/src/features/player/` | Join, nickname/avatar, live question, reconnect, podium |
| `apps/web/src/features/live/` | Shared phase rendering, clock estimate, socket lifecycle |
| `apps/web/src/features/media/` | Bounded prefetch queue and readiness state |
| `apps/web/src/components/` | Shared accessible UI primitives |
| `apps/web/src/services/` | HTTP client, WebSocket client, cache adapter |
| `apps/web/public/` | Local fonts, built-in avatars, icons, PWA assets |
| `tests/integration/` | Worker/DO runtime and persistence tests |
| `tests/e2e/` | Playwright multi-browser flows |
| `tests/load/` | Opt-in local/staging 150-player simulation |
| `docs/` | These canonical documents and implementation evidence |

Use a pnpm workspace, one lockfile, strict TypeScript. Avoid monorepo orchestrators unless a measured need appears. Pin mutually compatible current stable versions during P0/P1; do not invent package versions from this document.

## Static routes
Use `/`, `/login/`, `/dashboard/`, `/builder/?quizId=...`, `/host/?roomId=...`, `/play/?code=...`, `/results/?roomId=...`.
Do not introduce runtime dynamic path segments requiring generateStaticParams for arbitrary room IDs. Wrap search-param client readers in appropriate Suspense boundaries and prove `next build` exports all routes. Do not use Next API routes, middleware-based auth, or its server image optimizer. Security belongs in the Worker; client redirects are UX only.

## Same-origin serving
Production: one Worker deployment serves `apps/web/out` through the ASSETS binding and routes `/api/*` and `/ws/*` to Worker code FIRST. Keep unrelated static requests asset-first. Test actual path precedence and 404s; never return the app HTML for an API error. Worker uses a free provider subdomain; no paid domain is required.
Local development: document a same-origin reverse proxy or exported-web + Wrangler workflow; cookies and WebSocket upgrades must work through the same browser origin. Do not solve CORS by allowing all origins.

## Dependency direction
- web -> contracts; web NEVER imports game-core or server repository types.
- worker -> contracts + game-core.
- game-core -> plain TypeScript; no Cloudflare, browser, D1 or HTTP dependencies.
- local (P8) -> contracts + game-core.
- Public contracts and private authoring DTOs must be separate types/serializers even if their fields overlap.

## Target scripts
By their owning phase, provide tested scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:load:local`, `pnpm db:migrate:local`, `pnpm deploy:staging`. Never claim a script exists before implementing it. Document credential-dependent scripts separately. No deployment during early phases.
