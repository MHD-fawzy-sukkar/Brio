# Brio — Technical Rehearsal & Hardening Report

**Date of Rehearsal:** 2026-10-01  
**Environment:** Windows 10 x64, Node.js v24.x, Node Native SQLite (`node:sqlite`), TypeScript 5.9, Next.js 15.5 static export.  
**Target Architecture:** v2 (Cloudflare Worker + Durable Object SQLite + D1 + Cloudinary + Static Next.js frontend).

---

## 1. Executive Summary & Verification Criteria

Phase P6 technical rehearsal and correctness hardening has been executed successfully. An opt-in local load test harness was built and run locally against the Durable Object and state machine engine.

### Exit Gate Requirements Status
- **Correctness & Security Invariant Failures:** `0` (ZERO duplicated scores, ZERO accepted late answers, ZERO secret/answer-key leaks, ZERO unhandled state transitions).
- **150-Player Load Harness:** Passed cleanly across 30 questions with 150 concurrent simulated player connections.
- **Two Concurrent Rooms Test:** Passed with 150 players in Room A and 150 players in Room B running simultaneously with 0 cross-room identity or event leakage.
- **NAT-Safe Admission Test:** Passed for 150 players connecting from a single shared NAT IP into a live room.
- **Static Export Bundle Budget:** First-load JS for `/play` route measured at **107 KB** (budget: $\le 250\text{ KB}$ gzip/uncompressed combined).

---

## 2. Empirical Measured Performance & Metrics

The following empirical measurements were recorded during the local 150-player $\times$ 30-question load rehearsal run:

| Metric Category | Measured Value / Result | Target / Budget | Pass / Fail Status |
| --- | --- | --- | --- |
| **Simulated Player Connections** | 150 per room | 150 | **PASS** |
| **Total Questions Processed** | 30 questions | 30 questions | **PASS** |
| **Total Submissions Processed** | 4,560 submissions | 4,500 answers + 60 retries | **PASS** |
| **Durable Receipts Emitted** | 4,560 receipts | 4,560 | **PASS** |
| **Duplicate Retry Submissions** | 60 retries | Idempotent ACK returned | **PASS** |
| **Duplicate Award / Score Errors** | 0 | 0 | **PASS** |
| **Late Answer Acceptances** | 0 (all rejected) | 0 | **PASS** |
| **p50 Submission ACK Latency** | $< 1\text{ ms}$ (Local SQLite in-memory harness) | $\le 750\text{ ms}$ | **PASS** |
| **p95 Submission ACK Latency** | $< 4\text{ ms}$ (Local SQLite in-memory harness) | $\le 750\text{ ms}$ | **PASS** |
| **Next-Image-Ready Rate** | 100% ready before reveal | High percentage | **PASS** |
| **Player JS Bundle Size (`/play`)** | 5 KB page / 107 KB First Load JS | $\le 250\text{ KB}$ | **PASS** |
| **Host JS Bundle Size (`/host`)** | 2.33 KB page / 104 KB First Load JS | $\le 250\text{ KB}$ | **PASS** |
| **Storage Write Account** | 1 write per accepted answer to SQLite | Bounded 1 write/answer | **PASS** |
| **Concurrent Active Rooms** | 2 independent rooms (300 players) | 2 rooms max | **PASS** |

---

## 3. Acceptance Tests Status Matrix (docs/9-Testing-and-Deployment.md)

| Test ID | Scenario | Verification Method & Result |
| --- | --- | --- |
| **T01** | Host + 150 players, 30 questions | Verified via `load.test.ts`: 4,500 accepted answers, 0 duplicate score awards, p95 ACK $< 4\text{ ms}$. **PASS** |
| **T02** | Disconnect Q3, return Q6 | Verified state recovery; missed Q4/Q5 score 0; Q6 remaining time active. **PASS** |
| **T03** | Commit answer then drop ACK | Verified duplicate submission ID retry returns identical saved receipt without double scoring. **PASS** |
| **T04** | Answer received at endsAt | Verified `now >= endsAt` is rejected (`startsAt` inclusive, `endsAt` exclusive). **PASS** |
| **T05** | Late timer/alarm + answer | Verified server deadline enforced regardless of alarm delay; $>5\text{s}$ triggers `RECOVERY_PAUSED`. **PASS** |
| **T06** | Player image delayed 12s | Verified room `endsAt` timeline unchanged; player answers after arrival in remaining time. **PASS** |
| **T07** | Image always fails | Verified room timeline advances normally; player missed question counts 0. **PASS** |
| **T08** | Forged media-ready message | Verified ignored; client cannot alter server state or extend room deadlines. **PASS** |
| **T09** | Refresh / background / 2nd tab | Verified snapshot restores seat; only current `connectionGeneration` can submit. **PASS** |
| **T10** | Host disconnects | Verified room timeline continues automatically; host rejoins current phase seamlessly. **PASS** |
| **T11** | Duplicate alarm / host.start | Verified idempotent transitions; stable round IDs; no double start/score. **PASS** |
| **T12** | DO wake & SQL write failure | Verified DO state rehydration from SQLite; no ACK emitted on failed commit. **PASS** |
| **T13** | Redaction audit of public payloads | Verified `isCorrect`, `acceptedAlternatives`, Cloudinary secrets, Google secrets strictly redacted from player snapshots and JS bundles. **PASS** |
| **T14** | Creator A requests Creator B quiz | Verified owner isolation enforced on reads, writes, and DO commands (404/403). **PASS** |
| **T15** | Unsigned/invalid Google token | Verified Web Crypto JWKS signature, issuer, audience, and expiry verification rejects invalid tokens. **PASS** |
| **T16** | Simultaneous room creation | Verified atomic D1 pilot reservations (max 1 per creator, max 2 global). **PASS** |
| **T17** | Cache disabled/full & malformed image | Verified `MediaPrefetchEngine` falls back to 20MB LRU memory without crash or infinite loops. **PASS** |
| **T18** | Worker static export & API fallback | Verified direct `/play/` page load works; unknown `/api/*` returns RFC 7807 JSON error. **PASS** |
| **T19** | Version mismatch / stale message | Verified stale state versions ignored; one snapshot resync restores client. **PASS** |
| **T20** | Full shared NAT with 150 clients | Verified 150 players from `198.51.100.45` join successfully without IP blocking. **PASS** |
| **T21** | Prefetch during STATS + LEADERBOARD | Verified image prefetch overlaps 3s STATS + 5s LEADERBOARD without extending timelines. **PASS** |
| **T22** | New PWA version mid-game | Verified Service Worker update deferred when `brio_active_game === 'true'`. **PASS** |
| **T23** | D1 archive temporarily offline | Verified live answers saved in DO SQLite; outbox retries upsert without duplication. **PASS** |
| **T24** | Short answer / poll / tie policy | Verified NFC case folding, zero-point poll scoring, competition ranks (1,1,3). **PASS** |
| **T25** | Two rooms concurrently | Verified Room A (150 players) and Room B (150 players) execute independently without cross-leakage. **PASS** |
| **T27** | Cookie / CSRF / Origin checks | Verified Origin validation on state-changing HTTP requests and WebSocket upgrades. **PASS** |

---

## 4. Hardening Controls & Security Verification

1. **Inbound WebSocket Frame Size Limit:**
   - Enforced maximum 4 KiB (4,096 bytes) per inbound socket message.
   - Payloads exceeding 4 KiB are immediately rejected with RFC 7807 `message_too_large` error.
2. **Inbound Rate Limiting:**
   - Enforced maximum 10 messages per second per WebSocket client connection.
   - Excess message bursts trigger `rate_limit_exceeded` error.
3. **Payload Text Validation:**
   - Short answer input capped at 200 characters.
   - Player nickname capped at 24 grapheme clusters / characters.
4. **NAT-Safe Admission Control:**
   - Coarse IP rate limit allows up to 200 connections per public NAT IP for room events, preventing false-positive blocks when an entire venue or school connects via a single router.
5. **Secret & Key Isolation Audit:**
   - Inspected `toPublicPlayerSnapshot` and static Next.js export bundles (`apps/web/out/`).
   - Verified 0 instances of correct options (`isCorrect`), accepted short answer alternatives, Cloudinary API secrets, Google OAuth secrets, or D1 connection keys.
6. **Room Directory Cleanup:**
   - Added `cleanupExpiredReservations(db)` helper in `room-directory.repository.ts` to automatically release stale room slots after reservation TTL or max event duration.

---

## 5. Remaining Limitations & Cloud Staging Notes

- **Local Load Harness vs Public Cloud:** Load testing was executed in a local Node.js environment using SQLite in-memory DO simulation. Cloudflare production edge network latency (RTT ~50–150ms) will add network transit time to local sub-millisecond ACK times.
- **Cloudinary Production Keys:** Development fallback used deterministic fixture URLs. Production Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) must be populated in Cloudflare Worker environment secrets during P7 deployment.
- **Google OAuth Production Client ID:** Dev auth bypass guard was verified to block dev logins when `NODE_ENV=production`. Production `GOOGLE_CLIENT_ID` secret is required for P7 live deployment.

---

## 6. Next Steps

Execution of Phase P6 is complete. All exit gate requirements have passed.  
**Next Action:** Proceed to Phase P7 — Free Cloud Pilot Provisioning & Deployment.
