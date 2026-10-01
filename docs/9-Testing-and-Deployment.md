# Brio — Acceptance, Operations and Sources

## Acceptance tests (implementation required)
| ID | Scenario | Expected result |
| --- | --- | --- |
| T01 | Host + 150 simulated players, 30 questions | One authoritative timeline, no duplicate awards; report actual CPU, quota, bytes and latency |
| T02 | Disconnect player in Q3, return in Q6 | Same player/score; Q4/Q5 missed=0; Q6 remaining time only |
| T03 | Commit answer then drop ACK | Same submission retry yields original receipt; no duplicate score |
| T04 | Answer received exactly at endsAt | Rejected; startsAt inclusive, endsAt exclusive |
| T05 | Late timer/alarm + incoming answer | Deadline still enforced; delay >5s triggers conservative recovery policy |
| T06 | Player image delayed 12s while others ready | Everyone else's schedule unchanged; affected player keeps countdown and may answer after image arrives |
| T07 | Image always fails | No room delay; clear failure state; missed if no accepted answer |
| T08 | Forged media-ready / never sends ready | Cannot start/stop/extend any phase |
| T09 | Refresh/background/second tab | Snapshot restores; only latest connection generation can answer |
| T10 | Host disconnects | Automatic timeline continues; host rejoins current phase |
| T11 | Duplicate alarm, host.start and scoring retry | No double start/close/score; stable round IDs |
| T12 | DO hibernation/restart and SQL write failure | Rehydrate durable state; no successful receipt for failed commit |
| T13 | Inspect player bundle, socket, snapshot, manifest | No correct flags, accepted alternatives, private keys or future question text beyond reveal window |
| T14 | Creator A requests B's quiz/media/room controls | Denied on reads/writes/WebSocket commands |
| T15 | Unsigned/expired/wrong-audience Google token | Rejected; mocked verification cannot run in deployment |
| T16 | Simultaneous room creation retries | Active limits atomic; same idempotency key returns same room; stale reservations repaired |
| T17 | Cache disabled/full; malformed/oversized image | Bounded fallback; no crash/infinite retries |
| T18 | Worker static export routes and API errors | Direct play/host URLs work; API returns JSON error, not index.html |
| T19 | Version mismatch / stale messages | One bounded resync; stale events cannot revert state |
| T20 | Full shared NAT with 150 joining clients | Genuine players not blocked by over-tight IP limit; individual flood still throttled |
| T21 | Stats/ranking then next image prefetch | Downloads overlap existing intervals, never extend them |
| T22 | New PWA version mid-game | No forced reload or removal of assets being used |
| T23 | D1 archive temporarily unavailable | Live accepted answers safe in DO; retry upserts don't duplicate results |
| T24 | Short-answer variants/poll/ties/void replay | Agreed normalization, correct zero/poll rules, shared ranks, no double awards |
| T25 | Two rooms concurrently | No cross-room events/identity, document aggregate usage |
| T26 | Future image preview inspection | Document accepted recreational preview limitation; no claim of full anti-cheat |
| T27 | Cookie/CSRF/Origin and expired session | Cross-origin mutation/WS denied; privilege expiry/revocation enforced |
| T28 | LAN internet unplugged (P8) | Local host + phones complete event; no Google/CDN dependencies |

## Rehearsal profiles
Baseline: 150 connections, 30 mixed questions, 20s question +3s stats +5s ranking, 80KB median mobile image. Simulate a burst of 150 submissions near deadline and reconnect bursts. Use separate correctness tests for 200-seat ceiling and denied 201st admission.

Normal simulated network: RTT 100ms, low jitter, 5Mbps. Poor: RTT 800ms +/-200ms, 128kbps, interrupted links of 10–60s. Transport packet loss simulation should be at network/proxy level where available; don't pretend dropping application messages equals TCP packet loss. Record tool limitations.

Design targets, NOT measured claims: normal-network p95 answer ACK <=750ms; p95 client display-time error <=300ms in controlled foreground browsers; normal-network reconnect recovery <=3s after successful socket restoration; player first-route JS budget <=250KB gzip excluding fonts/media; no creator-only bundles on player route. Poor-network profile is assessed for state correctness and recovery rather than guaranteed subsecond latency. Capture image-ready-at-start rate instead of claiming 100%.

Mandatory correctness: zero duplicated scores, zero accepted-after-deadline new answers, zero leaked answer keys, zero disappearance of durably acknowledged answers within retention. Use actual browser clients in addition to a socket harness; only browser tests reveal image decoding and mobile background behavior.

## Free deployment checklist
- Pin tested versions; document provider limits as of deployment date.
- Free Worker account, SQLite-backed DO binding/migration, free D1, ASSETS static export, Cloudinary free. No R2/paid extra dependency required.
- Verify actual account availability and reachable URLs from target players' networks; don't assume local simulation proves regional reachability.
- Configure Google allowed origins and client ID, signing secrets, Cloudinary credentials via secret management. Keep dev auth off.
- Same-origin `/api/*` + `/ws/*` override static routes; test cookie flags and upgrades on deployed domain.
- Apply additive D1 and versioned room SQL migrations with backup/export plan. Do not destroy existing records.
- Stage with synthetic non-sensitive quiz. Run a real multi-device smoke test before inviting participants.
- Check usage dashboards and set operating thresholds; no surprise paid upgrade when quotas end.
- Keep old deploy artifact, rollback command and schema-compatibility notes. Rolling back code does not roll back database data. Don't deploy breaking room protocol changes during an event.
- Export finished results; retention and cleanup tested. Display notices if archive pending.

## Load and data estimates
150 * 30 = 4,500 possible answers. 30 *80KB =2.4MB/player and ~360MB image delivery for 150 cold-cache players, excluding host rendition, UI and retries. At 128kbps, an 80KB image takes about 5 seconds ideally before RTT/overhead. A 20-second question plus 8-second results interval provides useful prefetch time; outages still defeat any such budget. These are arithmetic estimates, not benchmarks.

DO free published quotas include 100,000 computed request units/day, 13,000 GB-s/day and 100,000 stored rows written/day; Worker/D1/Cloudinary have separate quotas. Inbound socket message accounting uses a 20:1 ratio for DO request billing only; it does not divide storage writes. Never promise that answer count equals total writes. Free quotas can change and are deployment constraints.

## Evidence log format
For each phase record: commit if available, environment, exact command, outcome, relevant metrics, failed/pending checks and blocking external configuration. Tests not run must say NOT RUN. User-facing release note must not advertise load targets as verified capacity before rehearsal.

## Official references consulted (2026-09-30)
These are provider facts; Brio defaults above are design decisions.
- DO WebSockets/hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- DO alarms and retries: https://developers.cloudflare.com/durable-objects/api/alarms/
- DO SQLite storage: https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- DO pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- DO limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Static assets: https://developers.cloudflare.com/workers/static-assets/
- Next static export constraints: https://nextjs.org/docs/app/guides/static-exports
- Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- Cloudinary free plan: https://cloudinary.com/pricing
- Cloudinary credit accounting: https://cloudinary.com/documentation/billing_and_plans
- Service-worker secure context: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- WebSocket security: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html

Planning caveat: no repository source was attached, no application code was changed here, and no load/deployment test was executed by this documentation task.
