# Brio — Protocol and Data Contract v1

Companion to architecture v2. Implement schemas in packages/contracts; examples are normative shapes to refine together with tests, not production source.

## 1. HTTP and origin
All production routes share origin. Static assets never intercept `/api/*` or `/ws/*`. JSON mutations require allowed Origin and CSRF protection; validate content type and body size. Use RFC 7807-style errors with `code`, `traceId` and safe detail. Never return stack traces/tokens. List endpoints are paginated (default 20, maximum 100).

| Method / route | Access and behavior |
| --- | --- |
| GET `/api/health` | Minimal health/build version; no secret/config dump |
| GET `/api/auth/nonce` | One-time login nonce and CSRF bootstrap |
| POST `/api/auth/google` | Verify ID token signature/iss/aud/exp/nonce; set creator cookie |
| GET `/api/auth/me` | Current creator or 401 |
| POST `/api/auth/logout` | Revoke session and clear cookie |
| GET/POST `/api/quizzes` | Creator-owned list/create |
| GET/PATCH/DELETE `/api/quizzes/:id` | Ownership on ALL operations; preserve active published versions |
| POST `/api/quizzes/:id/questions` | Add one validated question |
| PATCH/DELETE `/api/quizzes/:id/questions/:questionId` | Verify question belongs to quiz and creator |
| PUT `/api/quizzes/:id/question-order` | Complete unique IDs or explicit revisioned move; no duplicate/missing IDs |
| POST `/api/quizzes/:id/publish` | Immutable version; validate all questions/media and limits |
| POST `/api/media/sign` | Authenticated constrained upload grant; quota checked |
| POST `/api/media/complete` | Verify provider ownership/metadata; store ready variants |
| POST `/api/rooms` | Creator-owned published version; Idempotency-Key; reserve room capacity |
| GET `/api/rooms/by-code/:code` | Minimal join metadata only; rate-limited |
| POST `/api/rooms/:roomId/join` | New nickname/avatar OR resume existing browser identity; cookie session |
| GET `/api/rooms/:roomId/snapshot` | Caller-scoped snapshot; no-store; reconnect/fallback only |
| GET `/api/rooms/:roomId/media` | Authorized bounded upcoming media manifest; not full quiz content |
| GET `/api/rooms/:roomId/results` | Host report or player's own/public final results; separate serializers |
| GET `/api/rooms/:roomId/results.csv` | Creator only; escape spreadsheet formula-leading cells |
| GET `/ws/rooms/:roomId` | Upgrade with session cookie, allowed Origin and role validation |

No GET mutates state except the necessary authenticated WebSocket handshake/connection attachment. Public room code is not a bearer authorization token. No perpetual polling fallback in MVP; bounded reconnect and one snapshot on restoration.

## 2. Sessions
Creator: verified Google subject is canonical identity; email is display/contact, never the sole account linking proof. Sessions stored in D1, cookie includes a random session identifier with authenticated signing, HttpOnly/Secure/SameSite=Lax in cloud. Verify expiry/revocation on HTTP and connection creation; reject/close expired privileged commands. Logout revokes session; live host checks must enforce a short bounded revocation cache, not forever trust a handshake. Do not query D1 for every player answer.

Player: cryptographically signed, random >=128-bit anonymous browser-session identifier in an HttpOnly Secure SameSite cookie, lifetime bounded to an event/recovery window. DO maps its hash to playerId. Signature/expiry checked on handshake; DO authorizes membership. A cookie cannot choose another player's ID. Do not bind identity to IP. Local HTTP cookie exception allowed only by explicit LAN/local config, never in cloud.

Cookies cannot be read by WebSocket JS but are sent on same-origin upgrade. Do not put credentials in URL parameters. If a transport requires tickets later, use single-use short-lived tickets without long-lived resume secrets in logs.

## 3. Socket envelopes
Client:
```json
{"v":1,"type":"answer.submit","requestId":"uuid","roomId":"r1","payload":{"roundId":"round12","submissionId":"uuid","optionId":"o2"}}
```
Server room-wide transition:
```json
{"v":1,"type":"room.state","roomId":"r1","stateVersion":17,"serverNow":1790766000000,"payload":{"phase":"QUESTION","roundId":"round12","questionIndex":11,"phaseStartedAt":1790766000000,"phaseEndsAt":1790766020000,"question":{"id":"q12","type":"MultipleChoice","text":"...","options":[{"id":"o2","text":"..."}],"image":null}}}
```
Private receipt:
```json
{"v":1,"type":"answer.receipt","requestId":"uuid","serverNow":1790766001200,"payload":{"submissionId":"uuid","roundId":"round12","status":"accepted","acceptedAt":1790766001190}}
```
Receipt during open round does NOT reveal correctness, awarded points or accepted alternatives. Reveal them only after close. State/snapshot serialization must cover this for reconnecting players as well.

| Client type | Server processing |
| --- | --- |
| `room.resume` | Last seen stateVersion optional; send fresh caller-scoped snapshot |
| `clock.sample` | Echo client monotonic t0 and server receive/send wall times; bounded rate |
| `answer.submit` | Current round/generation/time validation, durable insert, receipt |
| `media.status` | Bounded batch of current/next readiness; telemetry only |
| `host.start` | Owner, lobby, valid version; idempotent start; no media barrier |
| `host.pause` | Owner; safe boundary now or queued after question |
| `host.resume` | Owner; persisted future deadlines |
| `host.end` | Owner; close session; explicit UI confirmation |
| `host.recover` | Owner; void/replay or void/skip interrupted round |

Server types: `room.snapshot`, `room.state`, `round.scheduled` (bounded future public reveal), `answer.receipt`, `answer.rejected`, `host.answer-count`, `round.results`, `leaderboard`, `room.finished`, `connection.replaced`, `clock.sample`, `error`.

Every accepted persistent host mutation has a request ID and replay-safe stored result. `room.snapshot` includes role, player identity if applicable, connectionGeneration, phase, immutable quizVersionId, round/deadlines, own receipt (without early correctness), own score/rank and top 5 when allowed. Host-only counts/controls never enter player serialization.

Use stateVersion for shared phase changes; personal/private messages don't consume it. Ignore stale shared state versions. A future scheduled payload is keyed by next roundId/startsAt, not applied as the current phase. Version gap, unknown round or protocol mismatch triggers one bounded snapshot/reload notice. Room.finished permits read-only restoration until retention expires.

## 4. Answer transaction
1. Capture receivedAt immediately on handler entry (server clock). Validate identity/generation, envelope, rate and max size first.
2. If same (playerId, roundId, submissionId) already exists with same payload digest: return saved receipt regardless of current deadline; don't insert or score again.
3. Reject conflicting duplicate IDs or a second answer for the same round. Don't let retries change options.
4. Reconcile persisted due transitions. Check active room/round, startsAt <= receivedAt < endsAt, correct option belongs to published question, and no prior answer.
5. Insert answer with canonical payload/digest and receivedAt in atomic room storage. A uniqueness constraint is the final guard.
6. ACK only after successful durable commit. Don't score/reveal yet. A storage failure produces retryable error, not accepted UI.
7. At close, score unscored/valid answers and persist round completion, totals and next deadlines atomically. Missed players need no per-round write: derive from participants minus accepted answers (and exclude void rounds).
8. Duplicate alarm/close sees completion marker and does nothing. Rebuild ranking from durable totals; send a compact result after commit.

A valid receipt is never dependent on an asynchronous D1 archive succeeding. Persist any archive/outbox work in room storage and retry at-least-once with idempotent D1 upserts.

## 5. D1 tables (minimum logical schema)
| Table | Key fields / constraints |
| --- | --- |
| creators | id, google_sub UNIQUE, display_name, email, created_at |
| creator_sessions | id_hash PRIMARY KEY, creator_id, expires_at, revoked_at |
| quizzes | id, creator_id INDEX, title, revision, created_at, updated_at, archived_at |
| questions | id, quiz_id INDEX, position, type, text, duration_ms, multiplier, media_id, essential, normalization_json |
| question_options | id, question_id INDEX, position, text, is_correct; private authoring only |
| short_answer_alternatives | id, question_id INDEX, normalized_value |
| media | id, creator_id, provider_public_id, rendition_json, version_hash, status |
| quiz_versions | id, quiz_id, revision UNIQUE per quiz, private_snapshot_json, content_hash, created_at |
| room_directory | room_id PRIMARY KEY, code UNIQUE, creator_id, quiz_version_id, status, reservation_expires_at, event_expires_at |
| archived_sessions | room_id PRIMARY KEY, creator_id, summary_json, completed_at, expires_at |
| archived_player_results | (room_id, player_id) PRIMARY KEY, nickname, avatar_id, total, rank, breakdown_json |

Indexes only where queried, conscious of free-plan write accounting. Use FK enforcement and migrations. Archived raw responses are private and finite; don't expose all players' answer text publicly.

Room creation crosses D1 and DO; no distributed transaction assumed. Atomically reserve a slot in D1 using a conditional SQL transaction/statement (one active room per creator and two global pilot slots). Persist idempotency key. Initialize DO with private immutable quiz snapshot, then mark reservation ready. On failure use reservation TTL and reconciler; joining pending/failed rooms is denied. Retry reuses same room, not another seat/slot. A periodic bounded housekeeping job repairs stale directory status; it doesn't control quiz timing.

## 6. DO SQLite tables
| Table | Purpose |
| --- | --- |
| schema_version | Room migration marker |
| room_meta | Owner, phase, stateVersion, deadlines, versionId, scheduled events, pause/recovery flags, expiry |
| quiz_snapshot | Private immutable published version, server-side only |
| players | playerId PRIMARY KEY, browser_session_hash UNIQUE, nickname, avatar, joinedAt, total, connectionGeneration |
| rounds | roundId PRIMARY KEY, questionId/index, startsAt/endsAt, status, scored flag, result summary |
| answers | (roundId,playerId) PRIMARY KEY, submissionId, digest, canonical response, acceptedAt, correct, points, voided |
| commands | requestId + actor UNIQUE, saved outcome, expiry; bounded cleanup |
| outbox | job ID PRIMARY KEY, archive payload/state, nextAttemptAt, retry count |

Durable identities and receipts survive cold start/hibernation/redeploy, subject to provider availability. Socket attachment stores identifiers/role/generation only; SQL remains authority. On wake reconstruct relevant state; never overwrite an existing alarm blindly. Shared-memory cached state is disposable.

For host disconnect, no heartbeat-driven global pause. For stale connections use transport keepalive / bounded client heartbeat, preferably DO automatic responses where supported to preserve hibernation. Browser cannot emit protocol ping frames directly; don't invent a WebSocket.ping() browser API.

## 7. Quotas and cleanup
Track actual storage rows and indexes; 150 players * 30 questions = 4,500 possible answer inserts, NOT 4,500 total platform writes. Scoring, players, indexes, outbox, archiving, deletes and alarms add writes. Design bounded metrics (aggregate, not per-frame durable logging).

After archive succeeds, keep room recovery data 24 hours, then expire it in bounded batches. D1 results retained 30 days. If archive fails, keep bounded recovery data up to 7 days and surface warning/export; cleanup must not silently discard unarchived acknowledged results without the documented retention notice. Expire published media only when no retained quiz version uses it. Ended-room traffic cannot indefinitely renew retention.
