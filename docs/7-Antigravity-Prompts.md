# Brio — Antigravity Phase Prompts

استخدمي برومبت واحد بكل مرحلة بعد وضع الملفات داخل `docs/`. البرومبتات بالإنكليزي لتكون تعليمات التنفيذ مباشرة؛ طلبت منه يعطيك تقرير النهاية بالعربي. لا تبعتي كل المراحل مرة واحدة. ما تنتقلي للمرحلة التالية إذا اختبارات المرحلة الحالية فاشلة. المتطلبات الخارجية الناقصة مثل حساب Google تُذكر بوضوح بدون ادعاء نجاح وهمي.

P0 يفحص المشروع ويحفظ الموجود. P1–P7 تبني النسخة الأونلاين. P8 اختياري لاحقاً للشبكة المحلية.

## P0 — فحص المشروع وحفظ نقطة البداية

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P0 — repository audit and migration baseline. Do not implement the new backend yet.
Inspect actual source under backend/, any frontend, git status, existing docs/AGENTS instructions, database configuration and migrations without printing secrets. Compare the legacy Project Memory claims to evidence. Check mocked Google token parsing, ownership on reads/writes, Arabic normalization and whether any valuable real data needs migration. Do not execute destructive migrations.
Preserve the current source, previous docs and git history. Use a separate migration branch when possible without disturbing uncommitted work. Install the supplied v2 docs as canonical and reconcile the unsupplied old Reference-Architecture.md. If those files were overwritten before this prompt, recover their old content from Git when available; say when unavailable. Map reusable business behavior to the new stack; do not port mock security.
Create docs/10-Repository-Audit.md listing verified/reported/missing items, existing data handling, doc conflicts, build evidence, and exact P1 starting point. Run relevant existing build/tests only when dependencies are safely available; label blockers. Update Project Memory. Do not begin P1.
Output in Arabic: what actually exists, what is retained, what will be rewritten, audit gate status and next prompt ID.
```

## P1 — تجهيز الباك والفرونت والعقود

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P1 — new workspace, same-origin skeleton and public contracts.
After the P0 audit, implement apps/web, apps/worker, packages/contracts and packages/game-core with pnpm workspaces and locked compatible stable versions. Retain backend/. Use strict TypeScript, a static-export Next app, Tailwind and a minimal Worker router. Configure SQLite DO/D1/ASSETS bindings and local placeholders without requiring paid accounts.
Create real static routes for login/dashboard/builder/host/play/results using query parameters. Arabic RTL, mobile-first accessible shell and local built-in avatars. Keep creator-only libraries off the player route. Do not add server actions/SSR or runtime Next APIs. Establish one-origin local workflow and API/WS precedence over static assets.
Implement versioned Zod schemas and role-separated public DTOs from the protocol; reserve private models outside contracts. Add health route, typed binding configuration, .env.example and tested scripts. A minimal diagnostic WebSocket may test upgrade routing but is not the game engine.
Exit gate: clean install, typecheck, lint and export/Worker build; direct /play/ and /host/ work; unknown /api route is JSON error, not HTML; local HTTP/WS same-origin works. Document commands and pending cloud configuration. Update memory and stop before P2.
```

## P2 — حساب صاحب المسابقة وبناء الأسئلة

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P2 — creator authentication and quiz builder.
Implement D1 migrations/repositories and real Google token verification using signature, allowed issuer, configured audience, expiry and one-time nonce. Use secure HttpOnly creator sessions, CSRF/Origin controls, logout/revocation, owner-isolated reads/writes. Test-injected verifiers must be excluded from deployed runtime; no decode-only or mock login in cloud. If Google configuration is missing, finish code/negative tests and explicitly mark real-login test blocked.
Implement quiz/question CRUD, revision-safe ordering and immutable publication. All four question types and points multipliers follow the plan. Accepted alternatives and correctness remain private. Conservative Arabic normalization is configurable; do not copy legacy ة/ه or ى/ي merging. Store media metadata fields now, but implement full upload pipeline in P5.
Build login/dashboard/builder with validation, draft save/error feedback and publish checks. Avoid unnecessary editor frameworks. Use prepared SQL and private/public serializer boundaries.
Exit gate: creator A cannot read/change creator B's quiz; invalid/expired/wrong-audience tokens fail; CRUD/reordering and question-type validation pass; published version is immutable; no authoring correct flags in public DTOs. Update memory and stop before P3.
```

## P3 — قواعد اللعبة والتوقيت والنقاط

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P3 — pure game-core, no provider dependencies.
Implement deterministic rules for LOBBY/COUNTDOWN/QUESTION/STATS/LEADERBOARD/FINISHED, safe PAUSED/RECOVERY_PAUSED, server deadlines, automatic progression and short pre-reveal window. Accept time as injected input; no Date.now() dependency in pure rules. Implement scored questions, zero-point polls, shared competition ranks and canonical short-answer matching.
Define answer/host-command idempotency decisions and persistence effects that the adapter will enforce transactionally. No client timestamp scoring and no offline backdated submissions. Readiness never affects phase deadlines. Host disconnection does not pause the game. Recovery after an overdue server transition >5 seconds must pause conservatively and support void/replay or void/skip without duplicate awards.
Write meaningful deterministic tests for startsAt/endsAt boundaries, duplicate transitions, pause/resume, interrupted-round replay, missing answers, polls, ties and Arabic alternatives. Use a fake clock and avoid real-time sleeps.
Exit gate: all core invariants pass; core imports no Cloudflare/DOM/HTTP modules; public output omits private answers before close. No new game rules hidden in UI. Update memory and stop before P4.
```

## P4 — تشغيل مسابقة كاملة بدون صور

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P4 — real live vertical slice with durable rooms.
Implement GameRoom DO with SQLite schema/migrations, private immutable quiz snapshot, atomic answer receipt/score transitions, one-alarm scheduler and WebSocket Hibernation API. Reconstruct from storage on wake. No external API calls in answer transactions. Duplicate alarms and failures cannot double-score or ACK an uncommitted answer.
Implement idempotent room creation with atomic pilot capacity reservations, join/resume cookie identities, connection generations, role/Origin checks, state snapshots, clock samples, bounded reconnect and authoritative deadlines. Archive through durable retryable outbox; D1 outage must not lose live accepted answers.
Connect actual frontend: creator creates room -> host lobby -> 3 browser players join nickname/avatar -> host start -> timed text question -> stats 3s -> ranking 5s -> next automatically -> final podium. Host disconnection continues. Each player sees own rank/top 5, not everyone's full answer data. Show sending vs accepted accurately.
Exit gate: automated runtime tests for lost ACK, duplicate answer, late answer, duplicate alarm, restart/hibernation, storage failure and role leaks; Playwright host + 3 contexts complete game and reconnect. Test snapshot serialization. No mock socket demo claimed as complete. Update memory and stop before P5.
```

## P5 — الصور والنت الضعيف والـ PWA

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P5 — bounded image pipeline and resilient frontend.
Implement creator-only constrained Cloudinary signing/completion, pre-generated immutable mobile/host variants, byte/dimension validation and publish readiness. No live image transformations, arbitrary remote URL proxy or socket media. Make provider configuration explicit; use fixture image server for deterministic tests if credentials are unavailable.
Implement prioritized prefetch/cache: initial first 3 images; next 2 during active question; prioritize next during 3s stats+5s ranking; concurrency <=2; default rolling window with bounded compressed/decoded memory. Validate actual image decode/version, retry with jitter, cancel obsolete work and avoid repeated fetches on rerenders. Preserve progress if cache storage fails.
CRITICAL: no client/media readiness barrier or quorum. Missing essential image keeps global clock running and temporarily disables only that player's answers; arrival enables remaining-time answer; expiry means missed. Decorative failure never blocks. One slow player/host image never alters room scheduling.
Add service-worker app-shell/media caching only (never auth/API snapshots), defer updates during sessions, resync on foreground, low-motion UI and local fonts/avatars. Clearly show image-delayed/reconnecting/accepted states.
Exit gate: T06/T07/T08/T17/T21/T22 pass with multiple browsers; prove one 12s image delay does not shift others' starts/ends; measure next-image-ready rate. Update memory and stop before P6.
```

## P6 — فحص الحماية وتحمل 150 لاعب

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P6 — correctness hardening and local load rehearsal.
Implement/verify message/schema/size/rate limits, NAT-safe admission, cookie/CSRF/Origin checks, session expiry, receipt/command idempotency, provider-secret redaction, quiz version pinning, reservations cleanup and retained results cleanup. Audit public bundles/snapshots for answer keys. Keep metrics aggregated and bounded.
Build/run opt-in local load harness for 150 players *30 questions, 150 near-deadline answer burst and reconnect burst; test two rooms independently. Pair it with real Playwright browser tests for media/timers/background behavior. Run relevant acceptance tests from docs/9-Testing-and-Deployment.md. Do not run uncontrolled traffic against a public free service.
Record actual environment, commands, p50/p95 ACK and display timing where measurable, lost/duplicate counts, request/storage-write estimates, downloaded bytes, image readiness and first player-route bundle size. If the environment cannot run a check, say NOT RUN and provide exact reproduction steps. Targets are not results.
Fix discovered issues within scope. Create docs/11-Rehearsal-Report.md and update memory. Exit gate: no correctness/security invariant failures, honest 150-player evidence, remaining limitations explicit. Stop before deploying P7.
```

## P7 — نشر تجريبي على الخطط المجانية

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P7 — free cloud staging/pilot deployment (this prompt authorizes deployment of the reviewed build to the designated staging/pilot environment).
Read audit/rehearsal evidence first; resolve blocking failures. Verify current free-plan limits and account availability through official docs and actual account setup. Use Cloudflare Worker + static assets + D1 + SQLite DO and Cloudinary free. No paid upgrades, R2, managed real-time add-ons or paid domain. If required setup requests billing, report the specific blocker instead of enabling it.
Provision/configure only the designated staging/pilot resources. Collect missing credentials through secure environment/secret setup; never commit/print them. Configure Google origin/client audience, disable dev auth, apply non-destructive migrations with backup/export and rollback notes. Correctly route API and WebSocket before static assets. Do not touch unrelated accounts or production databases.
Deploy and perform a real multi-browser/mobile smoke game with actual auth, image upload, reconnect and final results. Observe usage dashboards. Document deployment URL, commands, rollback, retention and remaining limits in docs/12-Pilot-Runbook.md. If account actions cannot be completed, deliver exact missing steps and don't claim deployment.
Update memory with actual outcome; P8 is optional and must not begin automatically.
```

## P8 — شبكة محلية بدون إنترنت «اختياري لاحقاً»

```text
You are implementing Brio in this repository. Read docs/5-Project-Memory.md, docs/SRS-Architecture.md, docs/Project-Structure.md, docs/Reference-Architecture-v2.md, docs/6-Implementation-Plan.md, docs/8-Protocol-and-Data.md and docs/9-Testing-and-Deployment.md. Treat archived .NET/Redis instructions as historical, subject to the P0 audit; preserve legacy source. Follow existing applicable repository instructions and report genuine conflicts.

Implement ONLY the phase specified below. Do the authorized reversible work and relevant tests; do not stop at a plan. Do not ask for approval for ordinary file edits/tests. Do not delete existing work, enable paid services, expose secrets, fabricate test success, or deploy unless this phase explicitly requests deployment. Never wait for slow players or media readiness; the server's timeline is authoritative. Keep future answer keys off player clients. Update Project Memory with actual evidence, not aspirations.

PHASE P8 — standalone LAN mode, only after the online MVP is stable.
Implement apps/local with Node.js, WebSocket and SQLite, reusing game-core/contracts rather than duplicating rules. Provide local host/admin authentication without Google, import/export of versioned quiz bundles with all media/fonts/avatars, traversal/decompression/schema checks, and player-safe redaction. Private answers stay on host disk.
Serve the static web UI and all media locally, expose LAN join URL/QR, persist sessions and receipts locally, implement matching scheduler/transactions. No runtime CDN/Google calls. Support ordinary HTTP LAN page without relying on service workers, or documented trusted HTTPS; never require disabling browser security. Include router/firewall/client-isolation instructions.
Run shared adapter conformance tests against cloud and local adapters, then disconnect router WAN and complete a game with host plus three physical phones if available. Reconnect/refresh must preserve score. If physical device tests aren't available, mark them NOT RUN. Implement later results upload with globally qualified IDs/idempotency; don't merge active cloud/LAN rooms.
Exit gate: tested local offline-from-internet flow, no hidden cloud dependency, no auto failover or split authority. Update memory and local run instructions. Do not advertise untested 150-device Wi-Fi capacity.
```

## إذا مرحلة تعطلت أو طلعت أخطاء

ابعتي هذا البرومبت ضمن نفس محادثة المرحلة، مع نص الخطأ. لا تطلبي منه إعادة بناء المشروع كله.

```text
Stay within the current Brio phase. Read the current Project Memory and the actual error output. Reproduce the failing behavior, identify the cause, and make the smallest coherent fix consistent with the canonical requirements. Do not change the stack, weaken auth, remove tests, introduce media-readiness barriers or mark checks passed without running them. Re-run only the relevant failed gate and necessary regression checks. Update Project Memory with evidence and reply briefly in Arabic: cause, fix, test result, remaining blocker. Do not start the next phase.
```
