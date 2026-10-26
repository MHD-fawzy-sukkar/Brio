# Deferred images, bounded sticky basics and question order — 2026-10-25

## Changes

- Creation now groups the basics/theme cards in their own grid, separate from the submit footer. On desktop the basics card is sticky at 6rem, bounded by that grid; short viewports use an internal scroll limit. The footer cannot intersect the sticky card. Mobile cards remain in normal flow.
- The dashboard return link is a visible secondary button with an arrow. The former last-activity statistic now counts quizzes containing at least one question as ready to play.
- Choosing identity images only validates files and creates local object-URL previews. Images can be assigned roles or removed before saving. No signature, CDN upload or completion request runs at selection time.
- Explicit save/create calls the deferred upload queue, with at most two concurrent uploads. Successful assets survive a failed save/retry without uploading those files again. Cancelling/navigation aborts the in-flight queue and releases previews. Local normalization is memoized per File during retries; gallery thumbnails use lazy decoding/loading.
- Studio questions have pointer/touch drag handles and ArrowUp/ArrowDown keyboard support. Dropping updates the order optimistically and sends one full-order request. Failures restore the prior order, and start/export/edit/delete actions are guarded while the order saves.
- The existing question-order API now validates a complete unique owner-scoped set and writes all positions/timestamp in one D1 batch. It reads only quiz ownership/question IDs rather than every question/answer/media field. Published versions and running games retain their frozen order.
- Room sockets reconnect immediately on online/foreground recovery instead of waiting out backoff; stuck handshakes time out. Closed rooms do not reconnect. Hidden mobile creator mascots stop requesting animation frames. Media-manifest retries have request deadlines and cancel their scheduled retries on unmount.

## Validation

- All 133 workspace tests passed: contracts 6, core 9, web 58, worker 52, local 8. Workspace typechecks/lint and production static build passed.
- New tests cover zero uploads during staging/removal, two-file concurrency, successful-asset reuse on retry, cancelled queues, reorder permutations/ownership/duplicate rejection/transaction rollback/frozen versions, and immediate reconnect/handshake deadlines.
- Real local 150-WebSocket-client burst passed without duplicate scores: total 247ms; receipt p95 241ms, including harness scheduling. This is loopback, not a phone/venue Wi-Fi measurement.
- Disposable browser preview: selected 20 real local image files. Server log showed only auth/theme-library GETs until the create button was pressed; after pressing it, exactly 20 signature/upload/completion sequences ran and the real quiz API created the quiz. Image signing/CDN completion were simulated locally; no real storage or production records were used for those tests.
- With the 20-image theme, the basics card followed scrolling and stopped with a 20px separation before the footer at the true page bottom. No overlap was observed.
- Dragged the fourth question to the top on desktop, saved, reloaded and confirmed persistence. Also dragged/reordered at 390px width and confirmed no horizontal document overflow. Keyboard ordering passed in both layouts. This is pointer automation at phone viewport size, not physical touch-device testing.

No additional D1 migration is required for this release; it uses the existing question-order route/schema. Deployment/version verification is recorded below after publication.

Final order audit also fixed appending after deletion: new questions use the maximum existing position plus one, so gaps cannot create duplicate positions. The additional regression test passed both before and after a drag reorder. The full run had 133 passing tests; this additional test brings the unique validated tests to 134 (Worker now 53).

Initial deployment: a26f4ead-7198-4d48-890b-bcdd2d4bffa8. The final backend correction is included in the subsequent version recorded below.

Final production version: 1b2e4868-ab25-4565-88c8-20cae486aedb (2026-10-25), including the append-after-deletion correction.


## Arabic terminology — 2026-10-26

Replaced the borrowed theme term in visible Arabic copy with هوية / هوية بصرية and the library label هوياتي البصرية. Applied across the dashboard, creation, studio, search, loading/error states, image/color controls, sharing/deletion dialogs and Worker validation messages. Internal routes/schema identifiers and user-authored names remain unchanged. The statistic card remains pending the user’s selection. Existing presentation checks and production build passed.

Arabic terminology deployment: c17d6397-874f-4240-8ef1-21e05c539afd. No statistic-card change was included.
