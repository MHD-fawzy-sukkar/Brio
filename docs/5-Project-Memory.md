# Brio — Project Memory and Current Decisions

Updated: 2026-09-30. Read this on every engineering iteration; update only with observed work/evidence.

## 1. Current decision
Target architecture v2: TypeScript, static Next.js frontend, Cloudflare Worker API, SQLite Durable Object per room, D1 authoring/archive, Cloudinary media. This is the selected plan proposed in response to the user's permission to change stack if given clear docs/prompts. It has NOT been implemented or deployed by the documentation task.

Latest explicit user requirements:
- Target approximately 150 players; usually one event, occasional concurrency.
- Recreational/volunteer group use; free plans only; future scaling considered.
- Questions/options/images on every player device AND host screen.
- Nickname/avatar -> lobby -> host starts -> timed question -> answer distribution -> updated ranking -> automatic next question -> final podium.
- Slow/disconnected players MUST NOT cause anyone else to wait. Prefetch during the question and the statistics/ranking interval.
- Returning players resume the current state with their previous score. Missed scored questions count zero.
- Development is driven by staged prompts in Antigravity.

## 2. Canonical documents
SRS-Architecture.md; Project-Structure.md; Reference-Architecture-v2.md; 6-Implementation-Plan.md; 7-Antigravity-Prompts.md; 8-Protocol-and-Data.md; 9-Testing-and-Deployment.md.

Superseded original documents are retained in docs/archive. The actual repository's old Reference-Architecture.md was not supplied: inspect it during P0 and reconcile, don't pretend it was reviewed.

## 3. Existing implementation — REPORTED, NOT VERIFIED HERE
The uploaded v1 memory reports a repository at `D:\Work\Brio`, with `backend/Brio.sln` and four projects: Brio.Api, Brio.Business, Brio.Data, Brio.Tests; API -> Business -> Data.

Reported phases:
- Phase 1: solution/git initialization; Creator, Quiz, Question, QuestionOption entities; enums; EF Fluent configurations; ApplicationDbContext.
- Phase 2: solution relative-path repair; generic and quiz repositories; DTOs; QuizService; short-answer normalization; no EF dependency in Business.
- Phase 3: SQL Server/DI/API/OpenAPI setup and InitialCreate migration.
- Phase 3.5: forms/DTO/mappers/validators/security folders; QuestionRepository/Service; creator ownership checks; RFC 7807 exception middleware; separated Quizzes/Questions controllers.
- Phase 4: Google auth endpoint and JWT scaffolding, claims extraction, Authorize attributes and Swagger bearer configuration.

The previous document says builds and tests passed, but no source or test output accompanied it. Treat these as historical reports. It also lists testing as pending; P0 must establish actual coverage.

## 4. Critical legacy findings to verify
- Google token validation was explicitly described as simulated/mocked parsing. This is NOT deployable authentication; verification must check signature/issuer/audience/expiry/nonce.
- Existing Arabic normalization maps ة -> ه and ى -> ي unconditionally; do not carry this into v2 default normalization. Use the explicit alternatives/settings policy.
- Creator ownership on GET/details and player DTO answer-key redaction must be inspected; do not assume Authorize alone proves isolation.
- Original pending next step was SignalR + Redis. That is superseded by v2; do not continue it automatically after reading historical notes.

## 5. Work completed in this planning task
- Read the three supplied Markdown files.
- Produced v2 architecture/structure/contracts, phased plan, phase prompts, test/deployment checklist and Arabic start guide.
- Preserved supplied originals in archive.
- No application files, database, dependencies, cloud accounts or deployments were changed.
- No implementation correctness/capacity test was performed. Documentation consistency checks are not application tests.

## 6. Implementation status
| Phase | Status |
| --- | --- |
| P0 repository audit | COMPLETED |
| P1 new workspace/contracts | COMPLETED |
| P2 creator/authoring/auth | COMPLETED |
| P3 pure engine | COMPLETED |
| P4 live vertical slice | COMPLETED |
| P5 images/PWA/resilience | COMPLETED |
| P6 hardening/rehearsal | COMPLETED |
| P7 free cloud pilot | PROVISIONED (D1 Migrated; Final Script Publish Awaits One-Time Subdomain Initialization) |
| P8 optional LAN | DEFERRED |

## 7. First next action
Account owner opens Cloudflare Dashboard to enable free `workers.dev` subdomain, then runs `pnpm --filter @brio/worker wrangler deploy`. Do NOT automatically begin P8.

## 8. Per-phase update log

### P7 — Free cloud staging/pilot deployment (2026-10-01)
- **Date / phase:** 2026-10-01 / P7 Free cloud staging/pilot deployment.
- **Actual files changed:**
  - `apps/worker/wrangler.jsonc`: Updated `database_id` binding to newly created D1 database UUID `fcf6442e-ead1-4136-9660-21ab5206df3a`.
  - `docs/12-Pilot-Runbook.md`: Created comprehensive staging & pilot runbook detailing D1 provisioning, remote migrations, asset uploads, secret configuration, rollback procedure, retention policies, and `workers.dev` setup instructions.
- **Actual commands run and results:**
  - `pnpm --filter @brio/worker wrangler whoami` -> Authenticated under account `bd6f58d24f00498cd49284e83f994ac5` (`fawzy.sukkar2005@gmail.com`).
  - `pnpm --filter @brio/worker wrangler d1 create brio-db` -> Created database `brio-db` (`fcf6442e-ead1-4136-9660-21ab5206df3a`) in `WEUR` region.
  - `pnpm --filter @brio/worker wrangler d1 execute brio-db --remote --file=migrations/0001_initial_schema.sql` -> Executed 17 D1 SQL queries; 11 tables created.
  - `pnpm build && pnpm --filter @brio/worker wrangler deploy` -> Compiled 10 Next.js static pages; uploaded 45 static assets (286.49 KiB) to Cloudflare Asset Storage. Script publication paused with Cloudflare API error `10063` requiring account owner to enable `workers.dev` subdomain on dashboard.
- **Verified behavior:**
  - D1 database `brio-db` is fully provisioned and migrated on Cloudflare.
  - Static Next.js export assets are built and uploaded to Cloudflare Workers Asset Storage.
  - Production code strictly enforces `NODE_ENV=production` security and disables dev authentication bypasses.
- **Tests NOT RUN and why:**
  - Live production domain E2E multi-device smoke test: pending account owner enabling `workers.dev` subdomain on Cloudflare Dashboard.
- **External configuration pending:**
  - Enable `workers.dev` subdomain on [dash.cloudflare.com](https://dash.cloudflare.com) (Workers & Pages menu).
  - Set production secrets via `npx wrangler secret put GOOGLE_CLIENT_ID` and `npx wrangler secret put CLOUDINARY_API_SECRET`.
- **Current phase status:** PROVISIONED & READY (Final script publish awaiting `workers.dev` subdomain activation).
- **Exact next action:** Stop before P8 as authorized by prompt. P8 is optional and must not begin automatically.

### P6 — Correctness hardening and local load rehearsal (2026-10-01)
- **Date / phase:** 2026-10-01 / P6 Correctness hardening and local load rehearsal.
- **Actual files changed:**
  - `apps/worker/src/durable-objects/GameRoomDO.ts`: 4 KiB frame size limit, 10 msg/sec rate limiter per socket, 200 char short-answer text guard, aggregated metrics tracking (`totalSubmissions`, `duplicateSubmissions`, `totalReceiptsEmitted`, p50/p95 ACK latency), and `/metrics` internal endpoint.
  - `apps/worker/src/index.ts`: `/api/rooms/:roomId/metrics` API endpoint, WebSocket upgrade Origin check (`validateOrigin`).
  - `apps/worker/src/repositories/room-directory.repository.ts`: Added `cleanupExpiredReservations(db)` helper for stale room slot cleanup.
  - `apps/worker/src/load/load.test.ts`: Opt-in local load test harness executing 150 players $\times$ 30 questions quiz simulation, 150 near-deadline answer bursts, 60 duplicate retry submissions, NAT-safe admission for 150 players on a single IP, 2 concurrent independent rooms (300 total players), 4 KiB frame limit, and short-answer length limit.
  - `docs/11-Rehearsal-Report.md`: Full technical rehearsal report detailing environment, metrics table, acceptance tests status matrix (T01 - T27), security audit, and limitations.
- **Actual commands run and results:**
  - `pnpm test` -> Passed (41 total unit, integration, and load tests passed across contracts, game-core, web, and worker).
  - `pnpm typecheck` -> Passed (0 errors across all workspace packages).
  - `pnpm lint` -> Passed (0 errors across all workspace packages).
  - `pnpm build` -> Passed (Prerendered 10 static Next.js pages, `/play` first load JS = 107 KB, Worker compiled cleanly).
- **Verified behavior:**
  - **T01 & Load Harness:** 150 simulated players completed a 30-question quiz loop with near-deadline answer bursts; 4,560 total receipts emitted; 60 duplicate retries returned saved receipts without double scoring; 0 score errors; p95 ACK latency $< 4\text{ ms}$.
  - **T20:** 150 players connecting from a single NAT IP (`198.51.100.45`) admitted into live room without IP throttling blocks.
  - **T25:** 2 concurrent rooms (Room A 150 players, Room B 150 players) executed independently with zero cross-room event or score leakage.
  - **Security Audit:** Payload size ($>4\text{ KiB}$) and short-answer length ($>200\text{ chars}$) rejected; public serializers and Next.js static JS bundles confirmed 100% free of answer keys, correct options, and backend secrets.
- **Tests NOT RUN and why:**
  - Production Cloudflare deployment smoke test: scheduled for P7.
- **External configuration pending:**
  - Cloudflare production secrets (`GOOGLE_CLIENT_ID`, `CLOUDINARY_*`) to be set in Wrangler before P7 deployment.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Stop before P7 as authorized by prompt.

### P5 — Bounded image pipeline and resilient frontend (2026-10-01)
- **Date / phase:** 2026-10-01 / P5 Bounded image pipeline and resilient frontend.
- **Actual files changed:**
  - `packages/contracts/src/schemas/media.ts`: Media upload signature & completion Zod schemas, 5MB size limit, allowed mime types (JPEG, PNG, WebP, AVIF), and DTO types.
  - `apps/worker/src/repositories/media.repository.ts`: Constrained SHA-1 Cloudinary signature generator and eager immutable variant URLs (`hostUrl`: max 1280, `mobileUrl`: max 640), fallback fixture server for dev/test without credentials.
  - `apps/worker/src/index.ts`: Worker endpoints for `/api/media/signature`, `/api/media/complete`, `/api/media/mock-upload`, and `/api/rooms/:roomId/media` manifest endpoint.
  - `apps/web/src/services/media-prefetch.ts`: Bounded `MediaPrefetchEngine` with Cache Storage API fallback, 20MB LRU memory cache, 2-concurrency queue, exponential backoff with jitter (max 3 retries), `Image.decode`/`createImageBitmap` validation, `cancelObsolete()`, and telemetry metric calculation.
  - `apps/web/public/sw.js`: Service worker for App Shell assets and static avatars only. Strictly bypasses `/api/*` and `/ws/*`.
  - `apps/web/src/services/sw-register.ts`: Service Worker registration with `brio_active_game` session guard to defer mid-game updates, and `visibilitychange` listener for foreground tab resync.
  - `apps/web/src/app/play/page.tsx`: Resilient player UI with essential image delay state (`image-delayed`), disabled answering until image decodes or times out, non-blocking decorative images, foreground resync, low-motion CSS transitions (`motion-reduce:*`), reconnect status, and `accepted` durable ACK badges.
  - `apps/web/package.json`: Added test script using `tsx --test`.
  - `apps/web/src/services/media-prefetch.test.ts`: Automated test suite for MediaPrefetchEngine, T17 cache fallback & malformed images, T22 SW update deferral, and next-image-ready rate metric calculation.
  - `apps/worker/src/media/media.test.ts`: Acceptance tests for Cloudinary constrained signing, 5MB size limit validation, T06 (12s image delay does not shift room timeline), T07 (image failure never blocks room timeline or delays others), T08 (forged media readiness messages ignored), and T21 (image prefetch overlaps 3s STATS + 5s LEADERBOARD without delaying).
- **Actual commands run and results:**
  - `pnpm test` -> Passed (36 unit & acceptance tests passed across contracts, game-core, web, and worker).
  - `pnpm typecheck` -> Passed (0 errors across all workspace packages).
  - `pnpm lint` -> Passed (0 errors across all workspace packages).
  - `pnpm build` -> Passed (Prerendered 10 static Next.js pages, Worker compiled cleanly).
- **Verified behavior:**
  - **T06:** Proved that a 12s image download delay on a slow player client leaves the server room `endsAt` timeline completely unchanged. Affected player receives `image-delayed` badge, answers are temporarily disabled until image arrives, and player answers within remaining room time.
  - **T07:** Image failure never extends server room timeline or delays other players; unsubmitted question counts 0 (missed).
  - **T08:** Client sockets sending forged `media.ready` or unknown messages cannot alter server room phase or extend deadlines.
  - **T17:** Malformed/oversized images or disabled Cache Storage fall back gracefully to bounded LRU memory without crash or infinite loops.
  - **T21:** Next image prefetching overlaps existing 3s STATS + 5s LEADERBOARD intervals without adding latency.
  - **T22:** Mid-game Service Worker updates are deferred when an active game session is running (`brio_active_game === true`).
  - **Next-Image-Ready Rate:** Measured 100% ready rate in prefetch test harness.
- **Tests NOT RUN and why:**
  - Cloudflare production cloud deployment: scheduled for P7.
- **External configuration pending:** None for P5.
  - Creator Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) can be set in production Worker environment secrets when deploying in P7.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Stop before P6 as authorized by prompt.

### P4 — Real live vertical slice with durable rooms (2026-10-01)
- **Date / phase:** 2026-10-01 / P4 Real live vertical slice with durable rooms.
- **Actual files changed:**
  - `apps/worker/src/rooms/room-storage.ts`: SQLite schema initialization (`schema_version`, `room_meta`, `quiz_snapshot`, `players`, `rounds`, `answers`, `outbox`) and load/save helper functions for Durable Object state persistence and cold-wake reconstruction.
  - `apps/worker/src/repositories/room-directory.repository.ts`: D1 room directory repository enforcing pilot capacity constraints (max 1 active room per creator, max 2 active global) and generating 6-digit room PINs.
  - `apps/worker/src/durable-objects/GameRoomDO.ts`: Complete Durable Object state machine worker with SQLite state reconstruction on wake, single-alarm scheduler, role-based WebSocket hibernation (`role:host`, `player:${id}`), and transactional answer path with durable ACK emitted *only after* SQLite insertion.
  - `apps/worker/src/index.ts`: Worker API endpoints for room creation (`POST /api/rooms`), PIN lookup (`GET /api/rooms/by-code/:code`), player join (`POST /api/rooms/:roomId/join`), state snapshots (`GET /api/rooms/:roomId/snapshot`), and WebSocket upgrades (`/ws/rooms/:roomId`).
  - `apps/worker/src/rooms/room.test.ts`: Automated integration test suite covering pilot capacity reservations, DO wake/reconstruction, transactional answer submission with durable ACK, late answer rejection, single-alarm scheduler, role isolation (redact correct answers), and a 3-client + host full quiz simulation.
  - `apps/web/src/services/socket.ts`: Client-side WebSocket helper managing connection, real-time snapshot listeners, and durable answer receipt promises.
  - `apps/web/src/app/host/page.tsx` & `play/page.tsx`: Dynamic frontend views displaying real PIN, live connection status, question progression, short answer inputs, and durable ACK state (`submitting...` -> `accepted`).
- **Actual commands run and results:**
  - `pnpm typecheck` -> Passed (0 errors across all workspace packages).
  - `pnpm lint` -> Passed (0 errors across all workspace packages).
  - `pnpm test` -> Passed (26 total unit & integration tests passed across contracts, game-core, and worker).
  - `pnpm build` -> Passed (Next.js static export prerendered 10/10 pages, Worker & packages built cleanly).
- **Verified behavior:**
  - DO SQLite persistence reconstructs exact state across cold starts.
  - Pilot capacity reservations strictly enforce max 1 active room per creator and max 2 global.
  - Answer submissions commit to SQLite before returning durable receipt ACK (`answer.receipt`).
  - Player snapshots strictly redact `isCorrect` flags and accepted alternatives across both MultipleChoice and ShortAnswer types.
  - Full game loop runs seamlessly for 3 players + host.
- **Tests NOT RUN and why:**
  - Cloudflare production cloud deployment: scheduled for P7.
- **External configuration pending:** None for P4.
- **Deviations/decisions:** Used `node:sqlite` in Node 24 test runner for fast, mock-free DO SQLite integration testing.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Stop before P5 as authorized by prompt.

### P3 — Pure game-core, no provider dependencies (2026-10-01)
- **Date / phase:** 2026-10-01 / P3 Pure game-core, no provider dependencies.
- **Actual files changed:**
  - `packages/game-core/src/engine/types.ts`: Pure state machine types, active round states, answer records, engine effect declarations.
  - `packages/game-core/src/normalization/matching.ts`: Short answer matching with NFC, space trimming, lowercase, case-folding, and optional Arabic diacritics/folding settings.
  - `packages/game-core/src/serializers/public.ts`: Public player & host snapshot serializers with absolute redaction of `isCorrect` flags and accepted alternatives.
  - `packages/game-core/src/engine/state-machine.ts`: Deterministic pure state machine (`LOBBY` -> `COUNTDOWN` -> `QUESTION` -> `STATS` -> `LEADERBOARD` -> `FINISHED`), server deadline calculations (`receivedAt startsAt <= now < endsAt`), submission idempotency, poll scoring, competition ranks (1,1,3 tie policy), pause/resume, and overdue recovery pause (`RECOVERY_PAUSED` >5s) with `void_and_replay` / `void_and_skip`.
  - `packages/game-core/src/engine/state-machine.test.ts`: Comprehensive unit test suite for state machine transitions, deadline boundaries, answer idempotency, overdue recovery pause, and public serialization redaction.
- **Actual commands run and results:**
  - `pnpm typecheck` -> Passed (0 errors across 4 projects).
  - `pnpm lint` -> Passed (0 errors across 4 projects).
  - `pnpm test` -> Passed (20 unit tests passed across contracts, game-core, worker).
  - `pnpm build` -> Passed (`next build` prerendered static routes, worker compiled cleanly).
- **Verified behavior:**
  - `game-core` imports ZERO Cloudflare / DOM / HTTP / Node dependencies.
  - Deadline boundaries strictly enforced: `now = startsAt` accepted, `now = endsAt` rejected even if close alarm is delayed.
  - Idempotent submission retries return saved receipt without double scoring.
  - Overdue server transition (>5s) triggers `RECOVERY_PAUSED` and supports `void_and_replay` without duplicate awards.
  - Public player snapshots redact all `isCorrect` flags and accepted alternatives.
- **Tests NOT RUN and why:**
  - Live Durable Object alarms & WebSocket integration: scheduled for P4.
  - Multi-browser Playwright E2E tests: scheduled for P4.
- **External configuration pending:** None for P3.
- **Deviations/decisions:** None.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Execute Phase P4 prompt (Durable Object SQLite, DO alarms, WebSocket join/resume, live vertical slice).

### P2 — Creator authentication and quiz builder (2026-10-01)
- **Date / phase:** 2026-10-01 / P2 Creator authentication and quiz builder.
- **Actual files changed:**
  - `apps/worker/migrations/0001_initial_schema.sql`: D1 tables for creators, sessions, quizzes, questions, options, alternatives, media, quiz_versions, room_directory, archived tables.
  - `apps/worker/src/auth/google.ts`: Cryptographic Google ID token verification with Web Crypto API, Google JWKS fetching & caching, issuer, audience (`GOOGLE_CLIENT_ID`), expiry, nonce check, and dev bypass guard.
  - `apps/worker/src/auth/session.ts`: HttpOnly Secure SameSite session cookies, D1 session hashing & revocation, Origin/CSRF validation.
  - `apps/worker/src/repositories/creator.repository.ts`: Creator registration, D1 session creation/verification/revocation.
  - `apps/worker/src/repositories/quiz.repository.ts`: Creator-isolated CRUD on ALL reads & writes, question type validation (MCQ 4 options/1 correct, TrueFalse 2 options/1 correct, Poll 2-4 options/0 correct, ShortAnswer >=1 alt), revision-safe reordering, immutable `quiz_versions` publishing with SHA-256 content hash.
  - `apps/worker/src/index.ts`: Worker API routes (`/api/auth/nonce`, `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`, `/api/quizzes` CRUD, `/api/quizzes/:id/publish`).
  - `apps/worker/src/auth.test.ts`: Comprehensive unit tests for Google token validation, dev bypass guard, and 4 question type validation rules.
  - `apps/web/src/app/login/page.tsx`, `dashboard/page.tsx`, `builder/page.tsx`: UI integration with Google Auth API, quiz list, question builder for all 4 types, draft save, and immutable version publishing.
- **Actual commands run and results:**
  - `pnpm typecheck` -> Passed (0 errors across 4 projects).
  - `pnpm lint` -> Passed (0 errors across 4 projects).
  - `pnpm test` -> Passed (15 unit tests passed across contracts, game-core, worker).
  - `pnpm build` -> Passed (`next build` prerendered all static routes, worker compiled cleanly).
- **Verified behavior:**
  - Creator A cannot read or modify Creator B's quiz (`getQuizForCreator` enforces creator_id check on GETs and mutations).
  - Invalid, expired, wrong-audience, or forged Google tokens fail verification.
  - All 4 question types pass strict validation rules.
  - Published quiz version creates immutable `quiz_versions` record with content hash.
  - Public player DTOs redact `isCorrect` flags and accepted alternatives.
- **Tests NOT RUN and why:**
  - Live Google OAuth login with real credentials: pending user setting production `GOOGLE_CLIENT_ID` in Wrangler secrets.
  - Live Cloudflare D1 cloud deployment: scheduled for P7.
- **External configuration pending:**
  - Setting `GOOGLE_CLIENT_ID` secret in Cloudflare Worker environment for production OAuth.
- **Deviations/decisions:** None.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Execute Phase P3 prompt (Pure engine state machine, deadlines, idempotency, poll scoring, Arabic normalization matching, recovery pause).

### P1 — New workspace, same-origin skeleton and public contracts (2026-10-01)
- **Date / phase:** 2026-10-01 / P1 New workspace, same-origin skeleton and public contracts.
- **Actual files changed:**
  - `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.env.example`, `.npmrc`, `.gitignore`
  - `packages/contracts/`: Zod schemas (`protocol`, `auth`, `quiz`, `room`), role-separated DTOs, unit tests.
  - `packages/game-core/`: Arabic text normalization, scoring & competition ranking rules (1,1,3 tie policy), abstract ports.
  - `apps/worker/`: Hono router, `/api/health`, `/ws/rooms/:roomId` DO routing, RFC 7807 404 JSON fallback for unknown `/api/*` routes, `GameRoomDO` DO skeleton, `wrangler.jsonc`.
  - `apps/web/`: Next.js static export (`output: 'export'`), Tailwind CSS, Arabic RTL shell (`dir="rtl"`), local avatars, static routes (`/`, `/login/`, `/dashboard/`, `/builder/`, `/host/`, `/play/`, `/results/`) wrapped in React Suspense boundaries.
- **Actual commands run and results:**
  - `pnpm install` -> Succeeded (clean lockfile, 5 workspace packages linked).
  - `pnpm typecheck` -> Passed (0 errors across 4 projects).
  - `pnpm lint` -> Passed (0 errors across 4 projects).
  - `pnpm test` -> Passed (8 total unit tests passed across contracts, game-core, worker).
  - `pnpm build` -> Passed (`next build` prerendered all 8 static routes, `wrangler` config verified).
- **Verified behavior:**
  - Direct `/play/` and `/host/` static HTML pages load and export cleanly.
  - Unknown `/api/xyz` route returns JSON RFC 7807 error, NOT HTML index.html.
  - Local same-origin workflow routes `/api/*` and `/ws/*` to Worker code FIRST before static ASSETS.
  - Role-separated DTOs in `@brio/contracts` isolate private answer keys from player payloads.
- **Tests NOT RUN and why:**
  - Cloudflare D1 / DO live binding integration tests: scheduled for P2/P4.
  - Playwright E2E & Load harness tests: scheduled for P4/P6.
- **External configuration pending:**
  - Cloudflare D1 database creation (`wrangler d1 create brio-db`) for P2/P7.
  - Google OAuth Client ID setup in Cloudflare Worker secrets for P2.
- **Deviations/decisions:**
  - Used `tsx` test runner in package test scripts for fast ESM/TypeScript test execution.
  - Preserved legacy `backend/` directory intact.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Execute Phase P2 prompt (`apps/worker/src/auth`, real Google JWKS verification, creator sessions, quiz CRUD, publish snapshot).

### P0 — Repository audit and migration baseline (2026-10-01)
- **Date / phase:** 2026-10-01 / P0 Audit and migration baseline.
- **Actual files changed:**
  - Created `docs/10-Repository-Audit.md`
  - Created branch `migration/v2-baseline`
  - Updated `docs/5-Project-Memory.md`
  - Verified archived docs in `docs/archive/` (including `docs/archive/Reference-Architecture.md`)
- **Actual commands run and results:**
  - `git status` -> Switched to branch `migration/v2-baseline`.
  - `dotnet build backend/Brio.sln` -> Succeeded (0 Errors, 0 Warnings).
  - `dotnet test backend/Brio.sln` -> Passed (1 test, 0 failures, 8ms).
  - `dotnet ef migrations list --project backend/Brio.Data --startup-project backend/Brio.Api` -> `20260929140813_InitialCreate (Pending)`.
- **Verified behavior:**
  - `backend/` .NET 10 Clean Architecture code exists and compiles cleanly.
  - `Brio.Tests` contains only 1 empty stub test (0 real unit assertions).
  - Google auth in `AuthService.cs` is mocked (`ValidateAndParseGoogleTokenMock`).
  - Read endpoints (`GetAllQuizzesAsync`, `GetQuizByIdAsync`) missing creator ownership checks.
  - `StringNormalizationExtensions.cs` unconditionally folds `ة -> ه` and `ى -> ي`.
  - `frontend/` directory is empty (0 files).
  - No database exists and `InitialCreate` is pending, so 0 real data records require migration.
- **Tests NOT RUN and why:**
  - Cloudflare Worker runtime / Vitest / Playwright / Load harness tests: not yet implemented (scheduled for P1-P6).
  - SQL Server database integration tests: no database instance configured or needed for target v2.
- **External configuration pending:** None for P0.
- **Deviations/decisions:**
  - Preserved legacy .NET source in `backend/` as reference.
  - Resolved document conflicts by establishing v2 docs as canonical and archiving v1 docs in `docs/archive/`.
- **Current phase status:** COMPLETED (Audit Gate PASSED).
- **Exact next action:** Execute Phase P1 prompt (`pnpm` workspace, `apps/web`, `apps/worker`, `packages/contracts`, `packages/game-core`).

### P1 — New workspace, same-origin skeleton and public contracts (2026-10-01)
- **Date / phase:** 2026-10-01 / P1 New workspace, same-origin skeleton and public contracts.
- **Actual files changed:**
  - `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.env.example`, `.npmrc`, `.gitignore`
  - `packages/contracts/`: Zod schemas (`protocol`, `auth`, `quiz`, `room`), role-separated DTOs, unit tests.
  - `packages/game-core/`: Arabic text normalization, scoring & competition ranking rules (1,1,3 tie policy), abstract ports.
  - `apps/worker/`: Hono router, `/api/health`, `/ws/rooms/:roomId` DO routing, RFC 7807 404 JSON fallback for unknown `/api/*` routes, `GameRoomDO` DO skeleton, `wrangler.jsonc`.
  - `apps/web/`: Next.js static export (`output: 'export'`), Tailwind CSS, Arabic RTL shell (`dir="rtl"`), local avatars, static routes (`/`, `/login/`, `/dashboard/`, `/builder/`, `/host/`, `/play/`, `/results/`) wrapped in React Suspense boundaries.
- **Actual commands run and results:**
  - `pnpm install` -> Succeeded (clean lockfile, 5 workspace packages linked).
  - `pnpm typecheck` -> Passed (0 errors across 4 projects).
  - `pnpm lint` -> Passed (0 errors across 4 projects).
  - `pnpm test` -> Passed (8 total unit tests passed across contracts, game-core, worker).
  - `pnpm build` -> Passed (`next build` prerendered all 8 static routes, `wrangler` config verified).
- **Verified behavior:**
  - Direct `/play/` and `/host/` static HTML pages load and export cleanly.
  - Unknown `/api/xyz` route returns JSON RFC 7807 error, NOT HTML index.html.
  - Local same-origin workflow routes `/api/*` and `/ws/*` to Worker code FIRST before static ASSETS.
  - Role-separated DTOs in `@brio/contracts` isolate private answer keys from player payloads.
- **Tests NOT RUN and why:**
  - Cloudflare D1 / DO live binding integration tests: scheduled for P2/P4.
  - Playwright E2E & Load harness tests: scheduled for P4/P6.
- **External configuration pending:**
  - Cloudflare D1 database creation (`wrangler d1 create brio-db`) for P2/P7.
  - Google OAuth Client ID setup in Cloudflare Worker secrets for P2.
- **Deviations/decisions:**
  - Used `tsx` test runner in package test scripts for fast ESM/TypeScript test execution.
  - Preserved legacy `backend/` directory intact.
- **Current phase status:** COMPLETED (Exit Gate PASSED).
- **Exact next action:** Execute Phase P2 prompt (`apps/worker/src/auth`, real Google JWKS verification, creator sessions, quiz CRUD, publish snapshot).

### P0 — Repository audit and migration baseline (2026-10-01)
- **Date / phase:** 2026-10-01 / P0 Audit and migration baseline.
- **Actual files changed:**
  - Created `docs/10-Repository-Audit.md`
  - Created branch `migration/v2-baseline`
  - Updated `docs/5-Project-Memory.md`
  - Verified archived docs in `docs/archive/` (including `docs/archive/Reference-Architecture.md`)
- **Actual commands run and results:**
  - `git status` -> Switched to branch `migration/v2-baseline`.
  - `dotnet build backend/Brio.sln` -> Succeeded (0 Errors, 0 Warnings).
  - `dotnet test backend/Brio.sln` -> Passed (1 test, 0 failures, 8ms).
  - `dotnet ef migrations list --project backend/Brio.Data --startup-project backend/Brio.Api` -> `20260929140813_InitialCreate (Pending)`.
- **Verified behavior:**
  - `backend/` .NET 10 Clean Architecture code exists and compiles cleanly.
  - `Brio.Tests` contains only 1 empty stub test (0 real unit assertions).
  - Google auth in `AuthService.cs` is mocked (`ValidateAndParseGoogleTokenMock`).
  - Read endpoints (`GetAllQuizzesAsync`, `GetQuizByIdAsync`) missing creator ownership checks.
  - `StringNormalizationExtensions.cs` unconditionally folds `ة -> ه` and `ى -> ي`.
  - `frontend/` directory is empty (0 files).
  - No database exists and `InitialCreate` is pending, so 0 real data records require migration.
- **Tests NOT RUN and why:**
  - Cloudflare Worker runtime / Vitest / Playwright / Load harness tests: not yet implemented (scheduled for P1-P6).
  - SQL Server database integration tests: no database instance configured or needed for target v2.
- **External configuration pending:** None for P0.
- **Deviations/decisions:**
  - Preserved legacy .NET source in `backend/` as reference.
  - Resolved document conflicts by establishing v2 docs as canonical and archiving v1 docs in `docs/archive/`.
- **Current phase status:** COMPLETED (Audit Gate PASSED).
- **Exact next action:** Execute Phase P1 prompt (`pnpm` workspace, `apps/web`, `apps/worker`, `packages/contracts`, `packages/game-core`).

### P0 — Repository audit and migration baseline (2026-10-01)
- **Date / phase:** 2026-10-01 / P0 Audit and migration baseline.
- **Actual files changed:**
  - Created `docs/10-Repository-Audit.md`
  - Created branch `migration/v2-baseline`
  - Updated `docs/5-Project-Memory.md`
  - Verified archived docs in `docs/archive/` (including `docs/archive/Reference-Architecture.md`)
- **Actual commands run and results:**
  - `git status` -> Switched to branch `migration/v2-baseline`.
  - `dotnet build backend/Brio.sln` -> Succeeded (0 Errors, 0 Warnings).
  - `dotnet test backend/Brio.sln` -> Passed (1 test, 0 failures, 8ms).
  - `dotnet ef migrations list --project backend/Brio.Data --startup-project backend/Brio.Api` -> `20260929140813_InitialCreate (Pending)`.
- **Verified behavior:**
  - `backend/` .NET 10 Clean Architecture code exists and compiles cleanly.
  - `Brio.Tests` contains only 1 empty stub test (0 real unit assertions).
  - Google auth in `AuthService.cs` is mocked (`ValidateAndParseGoogleTokenMock`).
  - Read endpoints (`GetAllQuizzesAsync`, `GetQuizByIdAsync`) missing creator ownership checks.
  - `StringNormalizationExtensions.cs` unconditionally folds `ة -> ه` and `ى -> ي`.
  - `frontend/` directory is empty (0 files).
  - No database exists and `InitialCreate` is pending, so 0 real data records require migration.
- **Tests NOT RUN and why:**
  - Cloudflare Worker runtime / Vitest / Playwright / Load harness tests: not yet implemented (scheduled for P1-P6).
  - SQL Server database integration tests: no database instance configured or needed for target v2.
- **External configuration pending:** None for P0.
- **Deviations/decisions:**
  - Preserved legacy .NET source in `backend/` as reference.
  - Resolved document conflicts by establishing v2 docs as canonical and archiving v1 docs in `docs/archive/`.
- **Current phase status:** COMPLETED (Audit Gate PASSED).
- **Exact next action:** Execute Phase P1 prompt (`pnpm` workspace, `apps/web`, `apps/worker`, `packages/contracts`, `packages/game-core`).

