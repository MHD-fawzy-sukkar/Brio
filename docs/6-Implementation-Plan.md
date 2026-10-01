# Brio — Implementation Plan

Execute sequentially. Each phase ends with changed files, commands actually run, pass/fail evidence, known limitations and an updated Project Memory. Never interpret this plan as already completed implementation.

| Phase | Backend | Frontend | Exit gate |
| --- | --- | --- | --- |
| P0 Audit and migration baseline | Inspect actual .NET source, secrets/config, data and old docs; preserve baseline; identify mocked auth | Inspect whether frontend exists and reusable components | Inventory + migration map + doc conflicts resolved; no code deletion |
| P1 Workspace and contracts | Worker, D1/DO bindings, shared schemas, health route | Static Next export, Arabic RTL shell, player/host/dashboard routes | Build/types; direct static routes, API/WS routing and local same-origin setup work |
| P2 Creator and quiz authoring | Real Google verification, sessions, owner-isolated CRUD, private publish versions | Login, dashboard, builder with four types and normalization options | Invalid tokens rejected; creator A cannot access B; quiz CRUD/publish tested |
| P3 Pure game rules | State machine, deadlines, idempotency model, scoring, tie policy, safe pause/recovery | Only small engine test fixture if needed; no fake production game | Deterministic tests for deadline, duplicate close, poll, Arabic answers, recovery |
| P4 Live vertical slice | DO SQL, transactions, alarms, room reservations, join/resume, sockets, durable receipts/outbox | Host lobby + player join + text-only live rounds, stats/ranking/podium | Host + 3 real browser clients; lost ACK/reconnect/cold-start tests; no leaks |
| P5 Media and poor-network UX | Signed bounded uploads, publish-ready variants, media manifest, quotas | Cache/prefetch, image states, PWA shell, clock resync, light motion | Delayed/failed player image never delays others; cache and SW update tests |
| P6 Hardening and load rehearsal | Rate/size limits, retention, race/storage failure tests, metrics | Device/RTL/accessibility checks; role-safe errors | 150-player rehearsal plus specified failures; publish honest measured report |
| P7 Free cloud pilot | Provision free bindings/secrets, staged migrations, rollback runbook | Deploy static output same origin; real-device smoke | One staging/pilot game with verified auth/media; quotas observed; no paid upgrade |
| P8 Optional LAN | Node/WebSocket/SQLite adapters, safe bundle import/export, local auth | Local resource resolution and local event entry | Router internet disconnected: 3 phones + host finish; later results import deduplicates |

## P0 specifics
- Current record reports completed .NET CRUD/auth scaffolding, but code was not attached. Verify every claim in the actual repository.
- Record branch/commit without exposing secrets. Prefer a dedicated migration branch and a normal baseline commit if appropriate; no forced history edits.
- Keep `backend/` intact and build it only for inventory/regression evidence. New cloud code lives in apps/packages.
- Find real existing data. If any, draft/test a non-destructive exporter and mapper before migration; no dropping SQL Server tables.
- Install new docs as canonical, archive previous conflicting docs after inspection. Record conflicts with old AGENTS/reference files; don't silently ignore active user rules.
- Do not spend this phase rewriting the backend.

## P1 specifics
Choose supported package versions from official docs/package metadata, lock them; a clean install/build should be reproducible. Provide .env.example, wrangler.example/config bindings and setup instructions without credentials. Establish API/static routing early, not at deployment day. Contract tests should reject unknown/oversized payloads. No paid bindings.

## P2 specifics
Use a verified Google ID token flow (signature + audience + issuer + expiry + nonce), not decode-only logic. Real credentials may require the owner to configure Google origins/client ID; complete local tests using injected test verifiers isolated from deployment. Never mark live OAuth verified until tested with a real token. Expose a clear blocked-config status, not fake login success.

Quiz validation: MCQ exactly 4 options and one correct; true/false exactly two fixed values and one correct; poll 2–4 options and none correct; short answer >=1 explicit accepted alternative, no choices. Text length <=1000 chars; option <=200; title <=120. Reordering must be revision-safe. Authoring can start text-only; image upload UI is P5, with schema reserved now. Publish returns immutable version; rooms pin it.

## P3/P4 boundary
Core owns decisions; DO owns durable uniqueness/transactions and serialized command application. Don't create a second memory-only game engine inside the hub/DO. Pure-core tests don't prove runtime persistence; integration tests must exercise the actual adapter.

In P4 fake image fixtures may be used for layout, but mark them as fixtures; no claim of media resilience until P5. Host disconnect continues the game as requested. Full live timeline is server-controlled and automated after start.

## P5 priority
The prefetch queue must first load the next question image during the current question, then use the 3-second stats + 5-second ranking interval to finish it. Never wait for all clients. Show global time while loading. Ensure image decode and matching rendition version, limited retries, correct eviction, no duplicate fetches on React rerenders. All fonts/avatars should be local and included in LAN-ready asset inventory.

## P6 test boundaries
Run heavy load locally first. Do not load-test a free public provider without checking its terms and explicit test environment authorization. User request for a pilot doesn't authorize uncontrolled DDoS-like tests. Normal local 150-client simulation is in scope. Derive capacity from results, not socket count claims.

## P7 credential/deployment handling
Document exact CLI commands supported by the pinned versions. Ask only for missing account setup/secrets, through appropriate secret entry; never request that secrets be pasted into source files or public chat. Don't simulate successful external provisioning. No cloud mutation before P7 deployment is actually requested. Free plan and no paid toggles are required; if a required flow asks for billing, stop that flow and report the concrete blocker.

## P8 boundaries
LAN is a separate event mode, not failover for a running cloud room. Reuse game-core and protocol; adapter parity tests must pass in both modes. Store private answer keys on host disk only. Ordinary LAN HTTP page must work without SW; no browser security bypass instructions. Local credentials and bundle import validations are required before sharing the LAN build.
