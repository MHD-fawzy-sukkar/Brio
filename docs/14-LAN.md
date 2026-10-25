# Brio LAN — first working slice

Updated: 2026-10-25. LAN runtime is local; cloud download support is deployed. Physical multi-phone venue acceptance remains pending.

## Run on Windows

One-time preparation while internet is available, from the repository root:

```powershell
node --version # Node 24.11 or newer; verified here with 24.11.1
pnpm install --frozen-lockfile
pnpm lan:build
```

Then double-click `Start-LAN.cmd`: it starts the server and opens the presenter dashboard in your default browser once ready. Keep its terminal open. Alternatively run `pnpm lan:start` and open the URL below manually. This is a local web server, not an installed desktop app. Node and this prepared checkout are required to play; pnpm is needed for installation/builds. A portable distribution is not implemented. The launcher reports missing Node, dependencies, or local pages with setup instructions. Opening the online website does not start this server.

1. Open `http://localhost:3210/local/` on the presenter's machine.
2. Presenter access opens automatically on the same laptop: no password or account is required. Session bootstrap accepts only a loopback connection AND a localhost/loopback URL with matching Origin; opening the LAN address never grants host access.
3. A two-question demo with a local image is imported on first launch. Open its room to rehearse.
4. Select the correct Wi-Fi adapter address in the lobby's network dropdown. VPN/virtual adapter addresses may also appear. The QR must point to the presenter's LAN address, never localhost.
5. Players connect to the same network, scan the QR, choose a nickname/avatar, and play in their browser. No app installation or prior page visit is required on phones.
6. Open the local dashboard again to return to rooms or their saved final results. Only one unfinished room may be created at a time. Its card offers return/end actions; opening another quiz requests explicit confirmation before ending the current room and preserving its results.

Optional environment variables: `BRIO_LAN_PORT` (default 3210), `BRIO_LAN_DATA` (default repository `.brio-lan/`). No Google, Cloudflare, or Cloudinary secret is required to play LAN.

The cloud web export stays in `apps/web/out`; the LAN export is `apps/web/out-lan`. Builds use runtime-specific output directories; run the preparation commands sequentially. LAN startup checks its export marker to avoid accidentally serving a cloud build. Rebuild after source changes; the running server does not hot-reload TypeScript.

## Transfer a real quiz

The online builder now has **تنزيل للّعب المحلي**. The button is available on the deployed site. Download the package while internet is available; import and play afterward without WAN access.

The button waits for the pending title save, refuses to export while image uploads are active, publishes an immutable version, then reads the owner-only `/api/quizzes/:id/lan-export` response (`Cache-Control: no-store`). The browser downloads each unique Cloudinary image with at most two concurrent requests and builds a single versioned JSON package containing quiz data and base64 image bytes. Any failed download aborts the package; it is never labelled ready with missing images.

Import that file through the local dashboard. It contains private answer keys and belongs on the host device only, not on player devices or in source control. No archive extraction, file paths, server URL fetching, or executable content is accepted. The importer checks schema/version, unique question/option IDs, answer rules, every referenced image, SHA-256, raster signatures, dimensions, and byte limits. It stores the quiz and all media in one SQLite transaction. Reimporting a quiz does not change an already-created room's frozen copy.

Initial explicit bounds: 48 MiB package HTTP body, 2 MiB quiz JSON, 500 questions, 500 KiB per image, max 2560 pixels per dimension and 4 million pixels total. Oversized or incompatible exports are rejected, never silently truncated. These are rehearsal bounds, not paid restrictions. The importer supports PNG/JPEG/WebP/AVIF; export only fetches HTTPS `res.cloudinary.com` images. Existing oversized images need an optimized replacement. Automatic rendition conversion is not implemented in this slice.

## Runtime and integrity

- `apps/local` uses Node HTTP, `ws`, and Node SQLite. It imports the same `@brio/game-core` decisions and public serializers as the Worker. It does not emulate or run Cloudflare.
- Node SQLite in the verified Node version emits an experimental-feature warning. No database native module compilation is required.
- A versioned local schema stores media, quizzes, and rooms. Each room's state/players/answers/session mapping is currently one atomic SQLite JSON row, with WAL and synchronous FULL. This intentionally small first adapter commits before ACK/broadcast and reloads the durable row for each command. It is not the planned normalized per-answer room schema; long-event write amplification must be measured before expanding beyond the rehearsal.
- Player identity is a random HttpOnly/SameSite cookie, stored only as a hash-to-seat mapping in SQLite. A second connection supersedes the first. Player IDs from message bodies cannot impersonate another seat. Host authentication bootstraps from loopback only. Mutations and WebSocket upgrades require the matching Origin; HTTP Host is restricted to machine IPs/localhost to resist DNS rebinding. Admin sessions rotate on logout/restart.
- Native HTTP LAN is explicit: cookies are not Secure and browser Service Worker/Cache Storage availability is not assumed. Use only a trusted event network. Never disable browser protections or certificate verification.
- Fonts, avatars, UI, and imported images are local. LAN HTML has a local-only content security policy. Online login/authoring paths redirect to the local dashboard. Submission IDs use `getRandomValues`, which works on ordinary LAN HTTP, rather than secure-context-only `randomUUID`.
- Deadline scheduling is server-side and continues without a host socket. Timer persistence failures retry without sending success. An overdue QUESTION follows the existing core's RECOVERY_PAUSED policy; the LAN host screen offers replay/skip. Results and acknowledged answers survive process restart. Keep the same player hostname/IP to retain the browser cookie; changing address creates a different browser origin.
- Scoring follows the **actual current core**, including its server-timed speed bonus. Older v2 specification prose saying “no speed component” is stale; this feature does not change scoring.
- Answer ACKs go only to the submitting player. Host counts refresh at most once per second instead of broadcasting the complete roster to every player on every answer. Shared phase changes still broadcast immediately.

## Images on phones

Images are served as immutable content-hash URLs from the local SQLite store. The shared prefetcher fetches the first three question images during the lobby, then a rolling current/next-two window. It caps concurrent downloads at two, compressed memory at 8 MiB, retained decoded image elements at two, and retries at three with backoff. Each attempt has a 10-second download timeout. A retry keeps its concurrency slot. Decode failures invalidate the cached response. Lobby UI reports first-window readiness; it does not claim the entire quiz is downloaded.

The current image is decoded before prefetch readiness is reported. Essential-image errors expose retry and keep answering disabled while the global timer continues. A failed or slow phone never postpones the room. All image traffic remains Wi-Fi traffic: LAN eliminates internet dependency, not radio contention. Per-device readiness aggregation on the host is not yet implemented.

## Verification and limits

Verified on this Windows checkout:

- Workspace TypeScript checks and cloud/LAN production exports.
- Final checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm lan:build`, and `git diff --check` passed. After the final prefetch timeout change, the web suite was rerun: 23 web tests; combined with the other passing suites (contracts 3, core 9, Worker 34, local 4), 73 tests passed across the executed suites.
- Automated host + three real localhost WebSocket clients finish a two-question game with an image; auth/owner redaction, concurrent joins, cookie resume, conflicting duplicate answers, failed SQLite save before ACK, scores, exact-deadline rejection, restart, and overdue replay are covered.
- A separate burst inside the LAN integration suite used **150 real loopback WebSocket clients**, one scored question plus a poll deadline check. One isolated run measured 241 ms total and 235 ms p95 receipt latency (includes harness scheduling). This is not a 150-phone/30-question/Wi-Fi capacity claim.
- Browser smoke: presenter on 127.0.0.1 and player on the machine's 192.168 LAN address; nickname/QR lobby, question image, accepted answer over insecure HTTP, automatic next question, and final podium. Browser error/warning log checked empty for the player flow.

Still required: host + three physical phones with WAN disconnected; Android Chrome and iOS Safari; sleep/background/reconnect; image-heavy room on the real router; 150-player/30-question sustained rehearsal with image-ready rates and Wi-Fi contention. This session did not disable the user's internet connection.

Before a venue test, keep the presenter on mains power and awake; preferably connect it to the router by Ethernet. Use a network permitting client-to-client traffic. If Windows Firewall prompts, allow the app only on the intended private event network; no firewall settings were changed by this task. Check the phone's browser can open the advertised IP/port before starting the room.

Cloud/LAN mid-game failover, offline quiz editing, portable installer, cloud result upload/deduplication, and automatic retention policies are not implemented. Local results persist until explicitly deleted from the dashboard. Back up `.brio-lan/` with the server stopped; do not copy only the SQLite main file while WAL writes are active.

## UX and reconnect follow-up (2026-10-24)

Removed terminal password entry in favor of loopback-only session bootstrap. Remote player devices still cannot acquire host privileges. The responsive dashboard now explains import, open, return, replace and results flows; room replacement requires confirmation, never a silently disabled button. Mobile join/play navigation hides creator/account links and uses a compact logo. QR network selection is remembered on the presenter browser.

An added real-socket test disconnects both a player and presenter after a durable receipt, checks the server timer broadcasts STATS to a remaining player without a triggering request, then rejoins the disconnected seat with its original nickname, score and receipt. The LAN suite passes five tests including this case. This proves adapter behavior in a local harness; physical-phone Wi-Fi/background tests remain pending.

All game/media traffic stays local after importing the quiz. Sharing a Wi-Fi network does not itself consume internet, even with WAN connected. An ordinary router without WAN is supported if client-to-client traffic is allowed. Windows hotspot behavior depends on adapter/client isolation and requires a venue rehearsal.

Follow-up verification: workspace typecheck, 23 web tests, 5 local tests, final LAN export and whitespace checks pass. Browser smoke imported a quiz containing an image through the file chooser, opened its room, joined via 192.168 HTTP, and reported image-ready. Mobile 375px DOM bounds show no horizontal overflow; desktop 1366px layout bounds fit. Existing presenter data/active room were preserved; UI smoke used a separate local database/port. A real LAN-address bootstrap request and a spoofed-localhost request both returned 403 without issuing a host cookie.

## Dashboard polish and deletion (2026-10-24)

- Presenter copy uses concise standard Arabic. Quiz import/list occupies the first content row; usage guide and previous-session results are adjacent at desktop widths and stack on phones. History scrolls within its card and uses compact divided rows.
- Reused RoamingBolt in a separate header column away from text and controls; hidden on narrow screens. Automatic flight stays near the header, while pointer capture permits dragging across the dashboard. The shared animator respects reduced motion and stops while the document is hidden. No new bitmap asset was introduced.
- Refactored local dashboard requests/types into services/local-dashboard.ts, state/actions into hooks/use-local-dashboard.ts and guide/history into components/local/LocalDashboardCards.tsx. Removed unreferenced legacy wandering CSS/keyframes and duplicate declarations. All four public assets are referenced; retained them and documentation preview images.
- Host-only DELETE /api/local/quizzes/:id removes an imported quiz; active use returns 409. Completed room snapshots/results remain intact. DELETE /api/local/rooms/:id permanently removes a finished session; active sessions return 409. Both UI actions require confirmation. Result deletion is separate from ending a room.
- Each deletion runs in one SQLite transaction and prunes only images unreferenced by any remaining quiz or room snapshot. The CLI seeds its demo only when creating a new database, so intentionally removed demos do not return on restart.
- Added API integration coverage for unauthenticated/active/missing-resource deletion, preserved results/media, and cleanup after removing the final reference. Six local tests and 23 web tests pass; TypeScript and the LAN production export pass.

Browser follow-up: verified both delete confirmations and cancellation without changing user data, visible Bolt flight inside the isolated header column, guide/history at the same vertical offset on desktop, and stacked 336px cards without horizontal overflow at a 375px phone viewport. Browser warning/error log was empty.

Follow-up: extensionless exported page requests redirect to their canonical trailing-slash URL with query strings intact. Active imported quizzes show an inline deletion explanation using the server-provided quizId. Legacy backend/, empty frontend/ and docs/archive/ were retired by explicit owner request after confirming no active build/runtime dependencies.

Verified after legacy removal: workspace TypeScript checks, LAN production export, six local integration tests and 23 web tests pass. Browser navigation to /join-game (without trailing slash) reaches the join form; pointer drag moved Bolt from its header position into the page with grab cursor and pointer events enabled. No existing quiz/room/result was removed by the agent during browser verification.

## Verified offline run and current UI (2026-10-25)

The latest rehearsal downloaded a real browser-generated package through the builder's download action against a disposable cloud-API fixture. The package contained the frozen quiz, its theme name/accent, logo and mascot/avatar image bytes; duplicate image URLs were fetched once. It was imported through the actual LAN dashboard file picker into a separate SQLite database, then a mobile-size browser joined through the machine's LAN address. Every external request was blocked while all LAN requests remained allowed. The host started the question, its imported image decoded, the player received an answer receipt, the game reached FINISHED, and a reload restored the theme. Observed: zero external requests and zero failed local resources. No user quiz/session/database was modified. This was a same-machine browser rehearsal over the LAN interface, not a physical phone/router capacity test.

Packaging now uses the shared JSON transport and a separately tested createLanBundle function. HTML API responses, failed images, HTML masquerading as images, and images over the established 500KiB limit fail packaging rather than returning an incomplete package. Two downloads run at once; logo, character, avatar and question references are embedded/deduplicated with SHA-256. Import validates raster signatures/dimensions/checksums and rejects missing images. The existing 48MiB total limit remains enforced.

The mobile PIN screen prioritizes the entry form. The join screen keeps a compact avatar preview beside the code, a four-column mobile avatar grid, readable branding/name, and a visible bottom join action. Fonts, Bolt artwork and theme images are served by the local host. The production cloud site itself does not become an offline server: keep the LAN terminal running, connect presenter and players to the same router/hotspot, and select the real Wi-Fi/Ethernet address in the room. LAN gameplay does not require a Google login. Quiz authoring/export and fetching new public themes still require internet before the event.

Quick start on this prepared checkout: double-click Start-LAN.cmd, open http://localhost:3210/local/ on the laptop, import the downloaded JSON file, select Open room, and share the LAN QR with phones on the same network. Keep the laptop awake and the terminal open. Dependencies and Node 24.11+ must be installed in advance; pnpm lan:build refreshes the local web files after source updates. If a phone cannot open the shown IP/port, check the selected adapter, local-network access/firewall prompt and router client isolation before starting. No network/firewall settings were changed automatically.
