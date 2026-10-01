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
| P1 new workspace/contracts | NOT STARTED |
| P2 creator/authoring/auth | NOT STARTED |
| P3 pure engine | NOT STARTED |
| P4 live vertical slice | NOT STARTED |
| P5 images/PWA/resilience | NOT STARTED |
| P6 hardening/rehearsal | NOT STARTED |
| P7 free cloud pilot | NOT STARTED |
| P8 optional LAN | DEFERRED |

## 7. First next action
Proceed with Phase P1: Workspace and Contracts. Initialize pnpm workspace, set up `apps/web`, `apps/worker`, `packages/contracts`, and `packages/game-core`.

## 8. Per-phase update log

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

