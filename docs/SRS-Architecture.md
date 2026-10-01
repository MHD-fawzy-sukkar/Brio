# Brio — SRS and Architecture v2

Revision: 2026-09-30. Target design, not a statement that code exists.

## 1. Product decisions
Brio is a volunteer/recreational live quiz platform. Initial measured target: 150 players in one room, usually one active event; separately test two simultaneous rooms. All players AND the host see question text, options and any image. Host sees answer distribution, then updated ranking; the next question starts automatically. Players choose nickname and built-in avatar, with no account. Creator login is required online.

No subscription-based question/player gates. Finite operational safety limits remain necessary; they are configuration, not a paid plan. No promise of unlimited capacity or perfect synchronization through disconnected networks.

### Binding requirement: never wait for slow players
A slow player, missing image, false media-ready message or disconnected participant MUST NOT postpone the start, close, statistics, ranking or next question for others. Media readiness is telemetry only. Do NOT implement an all-player barrier, readiness percentage threshold, quorum, or host intervention for an individual download failure.

## 2. Chosen stack and scope
- TypeScript; Next.js static export and Tailwind for the frontend.
- Cloudflare Workers for API and static assets, plain WebSocket for live protocol.
- One SQLite-backed Durable Object (DO) per room, with hibernatable WebSockets.
- D1: creators, sessions, quiz authoring, room directory and archived results.
- Cloudinary: constrained uploads and pre-generated image renditions, URLs/metadata in D1.
- Shared pure game-core and public contracts.
- Vitest plus supported Cloudflare runtime test tooling, Playwright, opt-in load harness.
- LAN runtime planned as P8 using Node.js + WebSocket + SQLite; not shipped in the cloud MVP.

P1–P7 deliver online MVP. P8 delivers optional LAN, using the same core. Do not build two backends simultaneously.

Existing .NET source is retained as legacy reference. Its reported CRUD and domain rules should inform the rewrite. Never connect the new runtime to the old mocked Google auth. A data migration is required only if actual valuable existing data is found; preserve it before any schema change.

## 3. MVP features
Quiz CRUD, authenticated creator ownership, draft/publish validation, immutable live quiz version, four question types (MCQ, true/false, short answer, poll), room creation and lobby, automatic rounds, answer receipts, reconnect, host stats/ranking, final podium, host results/export. Video, custom player uploads, spectator scale-out, team scoring, speed bonuses, mid-round online/LAN failover and full anti-cheat are deferred.

Short answer: trim, collapse whitespace, Unicode NFC and case-fold Latin by default. Optional Arabic diacritic/tatweel removal and alef folding are quiz settings. Do not automatically merge ة/ه or ى/ي. Creators can enter explicit accepted alternatives. Persist normalization settings with the published version.

Points: correct standard = 1000, double = 2000, zero/poll = 0, wrong/missed = 0. No speed component in MVP. Ties share competition rank (1,1,3); within a tie use join order solely for stable display, never as a hidden score advantage. Show up to four podium cards and disclose additional tied players in the full results.

## 4. Default room settings
| Setting | Pilot default / allowed behavior |
| --- | --- |
| Question duration | 20 seconds; creator-selectable 10–120 seconds |
| Initial countdown | 3 seconds |
| Answer statistics | 3 seconds |
| Ranking | 5 seconds |
| Next question | Starts directly after ranking; no extra readiness delay |
| Late new players | Disabled after start; existing players may reconnect |
| Host disconnected | Game continues automatically; no automatic pause |
| Participant target | 150, tested, not a guarantee before tests |
| Pilot admission ceiling | 200 seats including disconnected registered players; configurable after measurement |
| Active rooms | At most 1 per creator, 2 deployment-wide for initial pilot; atomic reservations |
| Lobby expiry | 45 minutes idle |
| Max event duration | 4 hours; reject start if configured timeline exceeds budget |
| Answerable content | Image marked essential or decorative by creator |
| Live snapshot budget | 2 MiB private quiz JSON; images excluded; explicit publish/start validation |
| Results retention | 30 days with export; raw room cleanup after successful archive and a short recovery window |

These are explicit proposed operational defaults, not observed platform limits. Never silently truncate a quiz. Authoring lists are paginated and questions are saved individually; no fixed marketing question-count limit.

## 5. Authoritative timeline
State machine: LOBBY -> COUNTDOWN -> QUESTION -> STATS -> LEADERBOARD -> QUESTION ... -> FINISHED. PAUSED and RECOVERY_PAUSED are explicit host/system states. Initial countdown is separate from the repeated round cycle.

Server persists deadlines before sending messages. No per-second network ticks. Next round startsAt = previous leaderboard endsAt. Each live payload includes serverNow, phaseStartedAt, phaseEndsAt, roundId, roomId, protocolVersion, stateVersion. Browser estimates server time using low-RTT samples and advances it using performance.now(). Re-sample on reconnect/foreground; no client authority over acceptance or score.

Current round public content can be delivered at most 500 ms before scheduled startsAt to improve rendering; UI hides it and disables answers until startsAt. This permits a small inspectable early-preview window and is acceptable for the recreational MVP. Do not claim cryptographic simultaneous reveal. Reconnecting late never gets a fresh duration. Missed schedule delivery leads to snapshot refresh, not a locally invented question.

DO has one alarm: persist an ordered schedule and arm the nearest due deadline (question reveal/open, close, stats end, ranking end, expiry or archive retry). Avoid repeating setInterval in the DO. Alarm retries are idempotent; a duplicate close cannot add score twice. Before commands, reconcile due transitions transactionally. Server rejects answers at `receivedAt >= endsAt` even if the close alarm is late.

Normal small alarm delays reconcile against persisted deadlines. If a scheduled transition is overdue by >5 seconds when the runtime next handles an event, enter RECOVERY_PAUSED rather than fast-forwarding unseen questions. This is a conservative failure policy, not proof of network outage. If the active round was interrupted, offer void-and-replay (new roundId, previous awards reversed atomically) or void-and-skip. No automatic replay that doubles points. Ordinary player/host network loss never triggers this policy.

Pause is allowed only at safe phase boundaries (after current question); a request while QUESTION queues the pause after closing. Resume creates future deadlines consistently and broadcasts a snapshot. No client controls timers.

## 6. Images and prefetch
At publishing, prepare immutable mobile WebP (target 50–120 KB, max 200 KB for essential mobile asset unless explicit validation override) and optional host rendition (max 500 KB). Preserve text/detail, dimensions and alt text. Ensure variants already exist and are fetchable before declaring the version ready. WebP first; no runtime image processing on the live path. Use a single bounded rendition vocabulary, not user-defined transformation strings.

Manifest entries: mediaId, contentHash/version, URL, byteSize, width, height, essential. Do not include answer keys or future question text. Use Cache Storage keyed by immutable URL plus version. Fetch with CORS when storing readable responses; avoid unstable signed URL cache keys. If storage is unavailable/full, use bounded in-memory fallback and show diagnostic state.

Priority: current essential image > next image > following image > decorative/HD. At most 2 concurrent downloads. During LOBBY fetch the first 3 image assets; during QUESTION fetch next 2; during STATS/LEADERBOARD prioritize upcoming asset and extend the window. Small full-session prefetch is allowed only when total media <=3 MiB; default rolling window and 8 MiB compressed active cache budget. Evict old room assets by LRU. Keep decoded images for current + next only. Limit image dimensions to avoid decoded-memory spikes. Do not clear cached assets still in use.

Use bounded retry with jitter (e.g. 0.5s, 1.5s, 3s), cancel obsolete requests and never retry an entire manifest on each render. A hash/version must match the exact published rendition. Image.decode (or equivalent actual display decode) determines client readiness. Readiness reports are optional, batched and never persisted per asset per player.

Missing essential image: keep global countdown, show "الصورة عم تتحمّل، وقت السؤال مستمر", disable answering until visible, allow an explicit retry; if image arrives in time enable answers for remaining time. If time expires, mark missed and continue. Never grant extra time or block other players. Decorative image failure never blocks answering. Late missing question text follows the same global-time rule.

Future image URLs are inspectable. Do not preload future correct answers; future text/options are withheld until reveal window. Encrypted image prefetch is deferred (complexity and additional runtime requirements). MVP is not an exam security product.

## 7. Reconnection and acceptance
Player identity is independent of socket ID and nickname. Use a random browser participant session cookie scoped to the origin; room mapping and player ID are server-controlled. Rejoining from the same browser resumes the same seat while valid. Browser storage cleared/new device requires a new session; don't promise recovery without credentials. Host may offer a controlled recovery flow later.

Reconnect with exponential backoff plus jitter, cap 15 seconds; expedite once on an online event, avoid concurrent sockets. Every reconnect/foreground requests authoritative snapshot. Do not replay old visual phases. If socket is gone, show reconnecting and never label an unacknowledged answer accepted.

One accepted answer per (roomId, roundId, playerId). Use submissionId for idempotency. On repeat, return the existing receipt even after close; if the payload conflicts reject it. First receipt wins; changing the answer is deferred. Persist answer before success ACK. A lost ACK must not lose/double points. Retry an existing submission ID to discover its receipt, but never backdate a new answer using client time.

A second tab supersedes the answering connection using a stored connection generation; stale sockets cannot answer. Disconnected players retain their score/seat. Questions missed during absence count 0. Keep distinct wrong/missed/void/poll classifications in results. Polls have no correctness.

## 8. Host/player views and lightweight frontend
Player route loads no creator editor, upload widget, analytics SDK, Google login script or large chart library. Use CSS bars for four-choice distributions, CSS transforms for podium, built-in local avatars and fonts. Bolt mascot is a lightweight static/SVG/CSS asset initially; avoid heavy animation libraries on the join path. Support prefers-reduced-motion.

After close, host shows distribution with explicit denominator (accepted responses), plus separate answered/missed counts. Polls and short-answer summaries have appropriate formats. Short-answer submitted text is aggregated/escaped; no unsafe HTML. Then all clients show ranking; each player sees own score/rank and top 5. Do not broadcast full roster/ranking to each player on every answer. Host roster is paginated or windowed; live answer count throttled to at most one update/second.

Network payloads small; no binary media in sockets. Cache app shell and assets, NEVER creator APIs, auth responses or live snapshots. Defer PWA activation/reload during an event. If online app wasn't previously loaded, offline launch cannot be guaranteed. An offline player cannot continue receiving live questions without a reachable server.

## 9. Security and quotas
Creator Google ID tokens must be cryptographically verified with Google JWKS, issuer, audience, expiry and nonce; cache JWKS respecting headers. Browser session uses signed short-lived HttpOnly Secure SameSite cookies and server-side revocation/session records. Require Origin/CSRF validation for state-changing HTTP; validate WebSocket Origin, role, room membership, schema, size and rate. CORS alone is not authorization. Production must fail startup when development auth bypass is enabled.

Default inbound socket max 4 KiB, nickname 24 grapheme clusters, short answer 200 characters, pending frames bounded. Rate-limit joins by browser session + coarse IP + room; use generous NAT-aware IP ceilings. Rate-limit command bursts per player; return structured errors. Never expose creator keys, Cloudinary secret, correct answers or private host commands in player snapshots/bundles/logs. Tokens must not appear in query strings or logs.

Upload only for authenticated creators: short-lived signed Cloudinary upload parameters, allowed formats and dimensions, max input 5 MiB, allowlisted transformation presets, verify returned asset ownership/signature or provider metadata before storing. No arbitrary server fetch URLs or untrusted SVG/HTML. Keep scripts/assets local except explicit Google login and Cloudinary media.

No paid services automatically enabled; remain on free plans. R2, Redis, external real-time vendors and paid image addons are not required. Track Worker requests, DO compute/storage writes, D1 reads/writes, Cloudinary credits. Reject additional new rooms near budgets while preserving active ones where possible; provider hard exhaustion can still interrupt them. DDoS protection is not quota immunity. Free services have no reliability guarantee for this event.

## 10. LAN (P8 only)
Same rules/contracts/UI; Node runtime provides storage, clock, transport and scheduler adapters. Local SQLite; import a versioned bundle containing private quiz data and media onto HOST device only. Player endpoints still redact answers. Serve all assets locally and provide local admin credentials; Google login disabled for LAN. No automatic cloud failover, no two simultaneous authorities for one session. Event chooses cloud or LAN at creation.

HTTP LAN page can run without service workers; service workers require secure context. Do not tell players to disable browser security or assume remote `http://192.168.x.x` is localhost. Offer ordinary-page mode or documented trusted local HTTPS. Test router client isolation, Windows firewall, Android/iOS and local URLs. Bundle import rejects path traversal, excessive decompression and schema mismatch. Upload results later with deployment-qualified IDs and idempotency.

## 11. Release condition
Follow 9-Testing-and-Deployment.md. Start with a technical rehearsal, then one 150-player pilot. Scalability means separate room ownership and replaceable adapters, not an untested claim. Scale one room only after measurement; don't add microservices/backplanes in MVP.
