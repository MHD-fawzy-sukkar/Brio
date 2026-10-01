# Brio — Repository Audit and Migration Baseline (P0)

**Date:** 2026-10-01  
**Branch:** `migration/v2-baseline`  
**Audit Gate Status:** PASSED (Ready for Phase P1)  

---

## 1. Executive Summary

This repository audit (Phase P0) establishes the empirical baseline for migrating Brio from the historical .NET 10 / SQL Server / SignalR reference prototype to the target **Architecture v2** (TypeScript, Next.js static export, Cloudflare Worker API, SQLite Durable Objects, Cloudflare D1, Cloudinary).

The current legacy source code in `backend/` was compiled, tested, and audited against the canonical v2 specifications. All legacy source code and historical documentation have been preserved intact. No destructive database migrations or code deletions were performed.

---

## 2. Verified vs. Reported vs. Missing Items Inventory

| Feature / Artifact | Legacy Reported Claim | Actual Empirical Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Backend Solution** | `backend/Brio.sln` with 4 projects (Api, Business, Data, Tests) | Solution and 4 projects exist and compile cleanly via `dotnet build` | **VERIFIED** |
| **Data Layer (DAL)** | Entities (`Creator`, `Quiz`, `Question`, `QuestionOption`), Fluent Configurations, `ApplicationDbContext` | Present in `Brio.Data`. Generic repository & EF Core configurations fully intact. | **VERIFIED** |
| **Business Layer (BAL)** | Services, Mappers, Forms, DTOs, Domain Exceptions, Validators | Present in `Brio.Business`. Strict separation from EF Core preserved. | **VERIFIED** |
| **API Layer** | `QuizzesController`, `QuestionsController`, `AuthController`, RFC 7807 Exception Middleware | Present in `Brio.Api`. OpenAPI/Swagger and JWT Bearer middleware configured. | **VERIFIED** |
| **Google Authentication** | Google OAuth & JWT authentication implementation | `AuthService.cs` uses `ValidateAndParseGoogleTokenMock()` which accepts any string or `mock:*` format without cryptographic verification. | **INSECURE (MOCK ONLY)** |
| **Read Ownership Isolation** | Creator ownership enforced on all operations | `QuizService.UpdateQuizAsync` and `DeleteQuizAsync` check ownership. `GetAllQuizzesAsync` and `GetQuizByIdAsync` do **NOT** check ownership (Creator A can read Creator B's quizzes/answers). | **DEFECT (MISSING READ ISOLATION)** |
| **Arabic Normalization** | Arabic short answer normalization | `StringNormalizationExtensions.cs` unconditionally maps `ة -> ه` and `ى -> ي`. | **DEFECT (INAPPROPRIATE DEFAULT)** |
| **Automated Test Suite** | "Builds and tests passed" | `Brio.Tests` contains only 1 empty xUnit stub test (`Test1()`). 0 unit/integration assertions exist. | **UNTESTED (EMPTY STUB)** |
| **Database & Real Data** | SQL Server database populated with migration | `20260929140813_InitialCreate` migration is **PENDING**. No LocalDB database exists; 0 real records present. | **NO REAL DATA TO MIGRATE** |
| **Frontend Application** | Directory at `frontend/` | `frontend/` directory exists but is completely empty (0 files). | **MISSING (EMPTY DIR)** |
| **v2 Target Stack** | Monorepo structure (`apps/web`, `apps/worker`, `packages/*`) | Not yet initialized. | **P1 STARTING POINT** |

---

## 3. Legacy Code Inspection & Critical Audit Findings

### 3.1 Security & Token Parsing (`backend/Brio.Business/Services/AuthService.cs`)
- **Finding:** Google ID token validation is entirely mocked. `ValidateAndParseGoogleTokenMock` parses unverified tokens or returns hardcoded values (`google-mock-id-12345`).
- **Impact:** No cryptographic signature verification, JWKS fetching, issuer, audience, expiration, or nonce checking occurs.
- **Action for v2:** Must be completely rewritten in `apps/worker/src/auth/` using official Google JWKS verification (`https://www.googleapis.com/oauth2/v3/certs`) and Google OAuth token validation rules as specified in [8-Protocol-and-Data.md](file:///D:/Work/Brio/docs/8-Protocol-and-Data.md#L12-L14).

### 3.2 Read Ownership Leak (`backend/Brio.Business/Services/QuizService.cs`)
- **Finding:** `GetAllQuizzesAsync()` fetches all quizzes across all creators (`_quizRepository.GetAllAsync()`), and `GetQuizByIdAsync()` retrieves full quiz details without comparing `quiz.CreatorId` against `currentUserId`.
- **Impact:** Creator A can list or view any other creator's private quiz content, including questions and correct options.
- **Action for v2:** All creator-facing read endpoints (`GET /api/quizzes`, `GET /api/quizzes/:id`) must strictly enforce owner isolation in D1 queries (`WHERE creator_id = ?`).

### 3.3 Arabic Text Normalization Defect (`backend/Brio.Business/Extensions/StringNormalizationExtensions.cs`)
- **Finding:** Hardcoded character substitution (`'ة' => 'ه'`, `'ى' => 'ي'`) runs unconditionally for all short-answer comparisons.
- **Impact:** Merges distinct Arabic spellings by default, violating requirements where creators may want exact spelling distinctions (e.g., "فاطمة" vs "فاطمه").
- **Action for v2:** Follow [SRS-Architecture.md Section 3](file:///D:/Work/Brio/docs/SRS-Architecture.md#L30): Unicode NFC, space trimming, lowercase/case-fold Latin by default. Arabic diacritic/tatweel removal and alef folding are optional quiz-level settings. `ة/ه` and `ى/ي` are NOT merged automatically; explicit accepted alternatives are used.

### 3.4 Test Suite Reality (`backend/Brio.Tests/UnitTest1.cs`)
- **Finding:** The sole test file contains `public void Test1() { }`.
- **Impact:** Previous reports of test success referred to a zero-assertion empty test suite.
- **Action for v2:** Comprehensive test coverage will be built in Vitest for `game-core`, Worker integration tests, and Playwright E2E tests as specified in [9-Testing-and-Deployment.md](file:///D:/Work/Brio/docs/9-Testing-and-Deployment.md).

---

## 4. Existing Data Handling & Database Migration Status

- **Database Inspection:** Ran `dotnet ef migrations list --project backend/Brio.Data --startup-project backend/Brio.Api`. Result: `20260929140813_InitialCreate (Pending)`.
- **Conclusion:** The initial migration was created in code but never applied to a SQL Server database. No live, staging, or local database exists, and there are zero user records or quiz data to migrate.
- **Action:** No database export or data mapping script execution is required. Legacy EF Core entity definitions (`Creator`, `Quiz`, `Question`, `QuestionOption`) serve exclusively as functional specifications for the D1 database schema in v2.

---

## 5. Documentation Hierarchy & Conflict Resolution

### 5.1 Canonical Document Inventory
The following documents in `docs/` are installed as canonical for Brio v2:
1. [5-Project-Memory.md](file:///D:/Work/Brio/docs/5-Project-Memory.md)
2. [SRS-Architecture.md](file:///D:/Work/Brio/docs/SRS-Architecture.md)
3. [Project-Structure.md](file:///D:/Work/Brio/docs/Project-Structure.md)
4. [Reference-Architecture-v2.md](file:///D:/Work/Brio/docs/Reference-Architecture-v2.md)
5. [6-Implementation-Plan.md](file:///D:/Work/Brio/docs/6-Implementation-Plan.md)
6. [7-Antigravity-Prompts.md](file:///D:/Work/Brio/docs/7-Antigravity-Prompts.md)
7. [8-Protocol-and-Data.md](file:///D:/Work/Brio/docs/8-Protocol-and-Data.md)
8. [9-Testing-and-Deployment.md](file:///D:/Work/Brio/docs/9-Testing-and-Deployment.md)

### 5.2 Archived Documentation & Reconciled Conflicts
The original `.NET` reference document has been archived at [docs/archive/Reference-Architecture.md](file:///D:/Work/Brio/docs/archive/Reference-Architecture.md).

| Architectural Concern | Legacy Document (`docs/archive/Reference-Architecture.md`) | Canonical v2 Specification (`Reference-Architecture-v2.md` & `SRS-Architecture.md`) | Resolution |
| :--- | :--- | :--- | :--- |
| **Backend Stack** | .NET 10 Clean Architecture (Api, Business, Data) | TypeScript, Cloudflare Worker API, Hono router | **Superseded by v2** |
| **Real-time Engine** | SignalR + Redis backplane | One SQLite-backed Durable Object per room, hibernatable WebSockets | **Superseded by v2** |
| **Database** | SQL Server via EF Core 10 | Cloudflare D1 (SQLite) for authoring/directory, DO SQLite for live state | **Superseded by v2** |
| **Dependency Injection** | Autofac assembly scanning | Pure TypeScript functions, explicit ports & adapters | **Superseded by v2** |
| **Authentication** | ASP.NET Core JWT Bearer + Identity | Cloudflare Worker verified Google JWKS + HttpOnly Secure session cookies | **Superseded by v2** |
| **Error Format** | RFC 7807 `ProblemDetails` middleware | RFC 7807-style JSON errors (`code`, `traceId`, `detail`) | **Aligned / Maintained concept** |
| **Domain Models** | Quiz, Question, QuestionOption, Creator | Preserved business domain rules; re-mapped to TypeScript contracts & D1 schema | **Behavior Mapped to v2** |

---

## 6. Build and Test Evidence

### 6.1 Solution Compilation
- **Command:** `dotnet build backend/Brio.sln`
- **Exit Code:** `0`
- **Result:**
  ```text
  Brio.Data -> D:\Work\Brio\backend\Brio.Data\bin\Debug\net10.0\Brio.Data.dll
  Brio.Business -> D:\Work\Brio\backend\Brio.Business\bin\Debug\net10.0\Brio.Business.dll
  Brio.Api -> D:\Work\Brio\backend\Brio.Api\bin\Debug\net10.0\Brio.Api.dll
  Brio.Tests -> D:\Work\Brio\backend\Brio.Tests\bin\Debug\net10.0\Brio.Tests.dll
  Build succeeded. 0 Warning(s), 0 Error(s).
  ```

### 6.2 Unit Test Execution
- **Command:** `dotnet test backend/Brio.sln`
- **Exit Code:** `0`
- **Result:**
  ```text
  Test run for D:\Work\Brio\backend\Brio.Tests\bin\Debug\net10.0\Brio.Tests.dll
  Passed! - Failed: 0, Passed: 1, Skipped: 0, Total: 1, Duration: 8 ms
  ```

---

## 7. Business Logic Mapping to Architecture v2

The following domain rules from the legacy implementation are mapped to the new TypeScript stack:

1. **Domain Models -> `packages/contracts` & D1 Schema:**
   - `Creator`: `id`, `google_sub`, `email`, `display_name`, `created_at`
   - `Quiz`: `id`, `creator_id`, `title`, `revision`, `created_at`, `updated_at`, `archived_at`
   - `Question`: `id`, `quiz_id`, `position`, `type` (`MultipleChoice`, `TrueFalse`, `ShortAnswer`, `Poll`), `text`, `duration_ms`, `multiplier` (`Standard`, `Double`, `Zero`), `media_id`, `essential`, `normalization_json`
   - `QuestionOption`: `id`, `question_id`, `position`, `text`, `is_correct`
   - `ShortAnswerAlternative`: `id`, `question_id`, `normalized_value`

2. **Validation Rules -> `packages/game-core` & `packages/contracts` (Zod):**
   - MCQ: Exactly 4 options, exactly 1 marked correct.
   - TrueFalse: Exactly 2 options ("صح" / "خطأ" or "True" / "False"), exactly 1 correct.
   - Poll: 2 to 4 options, 0 marked correct.
   - ShortAnswer: No choices; >= 1 explicit accepted alternative string.
   - Question duration: 10 to 120 seconds (default 20s).
   - Points calculation: Standard = 1000, Double = 2000, Zero / Poll = 0. Wrong or missed = 0.

3. **What is NOT ported:**
   - Mock token parsing in `AuthService.cs`.
   - Unconditional `ة -> ه` and `ى -> ي` character folding.
   - Unrestricted GET quiz endpoints without creator isolation.
   - Autofac / EF Core infrastructure code.

---

## 8. Exact Starting Point for Phase P1

Phase P0 is complete and verified. The audit gate is **PASSED**.

**Phase P1 Scope & Initial Tasks:**
1. Initialize pnpm workspace with `pnpm-workspace.yaml`.
2. Create directory structure:
   - `apps/web/` (Next.js static export)
   - `apps/worker/` (Cloudflare Worker API & Durable Object bindings)
   - `packages/contracts/` (Zod schemas, shared DTOs, protocol types)
   - `packages/game-core/` (Pure game state machine, scoring, normalization)
3. Set up TypeScript configurations (`tsconfig.json` base & per-package).
4. Implement `/api/health` health check endpoint in `apps/worker`.
5. Implement basic static Next.js shell with Arabic (RTL) layout.
6. Verify local build (`pnpm build`) and typecheck (`pnpm typecheck`).
