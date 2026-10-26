# Creator participation statistic

The dashboard replaces the ready-to-play card with إجمالي المشاركات. The metric counts recorded player sessions across the creator’s online rooms: reconnecting the same player does not add another participation, while joining another room does. Local offline games are excluded.

Each Durable Object retains a small participation history, including players who leave. Existing retained players are backfilled at initialization. Legacy sessions already removed before this feature cannot be reconstructed. Archived result counts are preserved as a baseline.

D1 stores only a monotonic room total. Owner-authenticated reads return the D1 snapshot immediately, scheduling at most eight stale rooms with two concurrent object requests in the background. Pending refreshes are checked every 2.5 seconds, capped at twelve checks per dashboard mount. The saved number remains visible while updating. Finished rooms are finalized once, and live rooms refresh through the existing one-minute memory cache. Freshness timestamps keep live snapshots current without blocking the response, and the account-scoped session cache restores this small metric on return visits. Background failures preserve the previous total. No D1 request is added to player joins or gameplay.

Validation: four focused tests cover reconnects/leaving, owner isolation, monotonic totals, bounded reconciliation, authentication and failed snapshots. All 57 worker tests and 58 web tests pass; workspace typecheck, lint and production build pass. Apply migrations 0009 and 0010 to the existing production database before deploying.
