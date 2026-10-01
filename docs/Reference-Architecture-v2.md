# Brio — Engineering Rules v2

Status: target. Applies to the new TypeScript tree; legacy .NET remains historical.

1. Read canonical docs before coding. Latest explicit user decision wins; resolve document conflicts in P0.
2. Complete one phase per prompt. Deliver a functioning vertical slice and evidence; do not silently implement future phases.
3. Keep UI, protocol, pure game rules and provider adapters separate. Use small functions/services, not generic repository hierarchies copied mechanically from C#.
4. Pure engine takes server time as an argument and returns state/effects; provider adapters own atomic persistence, sockets and scheduling. Private answer keys never enter public contracts or frontend dependencies.
5. Each room has exactly one authority. Mutations and close/scoring decisions must be transactional. JS single-threading does not make async I/O sequences atomic; test overlapping operations and re-entry. Keep external HTTP/D1/Cloudinary calls out of answer transactions.
6. Commit durable results before ACK/broadcast. Storage errors must not leave mutated authoritative memory acknowledged. Rehydrate or discard speculative memory after failure. Room SQL migrations are versioned and resumable.
7. Persist phase/round/deadline/state version and receipt idempotency. Use recipient-specific serializers; never spread a private room object into public JSON.
8. Public stateVersion increments on visible room state transitions; not on every private answer. Answer receipts and personal snapshots have independent result IDs. This avoids false client gap detection from other players' submissions.
9. Auth and role checks happen on server for every operation. Keep fixtures isolated; production cannot use mocked Google tokens or default admin passwords.
10. Types validate compile-time structure; Zod validates untrusted input. SQL is parameterized. Creator ownership is checked on reads as well as writes.
11. No readiness barriers, no per-client deadline extensions, no scoring from client timestamps, no per-second global socket timer, no offline backdated submissions.
12. No global room singletons, unbounded in-memory queues, full-quiz socket dumps, or retransmission of full leaderboards on each answer. Cache immutable media with byte/decoded-memory bounds.
13. Freeze published quiz version on room creation. Edits create a new version; active rooms do not mutate.
14. Keep build compatibility explicit: workspace versions locked, runtime bindings typed, .env.example has names/placeholders only. No secrets committed; redact logs.
15. Test high-risk invariants meaningfully: deadline boundaries, repeats, auth, no leaks, reconnect, storage failure and alarm retry. Avoid tests that just mirror component markup.
16. UI feedback describes actual state: sending, accepted, reconnecting, media delayed, time ended. Do not show accepted before durable ACK.
17. Review changes against docs, report files changed and commands/results. Never claim tests, deployment or capacity that were not run. Add untested/pending items to Project Memory.
18. Do not delete legacy source, rewrite git history, run destructive production migrations, or deploy without the phase/request calling for it. Normal reversible edits/tests are authorized by the active phase.
19. Prefer native WebSocket and a small fetch client; use one minimal Worker router (Hono is acceptable). Use parameterized SQL migrations over a large ORM for this MVP. No Redis or hidden recurring paid dependency.
20. Document any justified deviation before relying on it. Do not change requirements merely to make a failing test pass.
