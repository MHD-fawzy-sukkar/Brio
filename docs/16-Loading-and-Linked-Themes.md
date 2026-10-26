# Loading, caching and linked themes — 2026-10-25

## Behavior

- Route-specific skeletons cover dashboard cards/statistics, studio identity/cover/questions, quiz creation columns, the theme library, question editor and join screens. Theme cards and artwork reserve their final space, include loading placeholders, and fall back to Bolt if artwork fails.
- Theme management has create, edit, delete, Arabic name search, and explicit dashboard/home buttons. The creation editor supports saving standalone themes through the existing authenticated identity API.
- A one-minute account-scoped cache deduplicates simultaneous reads and immediately reuses fetched lists/details on navigation. A bounded session snapshot also restores fresh creator data on a full reload. Stale data can remain visible during background refresh; mutations invalidate related entries. Logout/account changes clear the scope; late responses from a previous scope cannot repopulate it. Blocked/full session storage falls back to memory caching.
- Theme library data is prefetched from the dashboard and creation/studio screens. Empty-state messages appear only after loading has finished. Search inside a quiz form prevents Enter from submitting that quiz accidentally.
- Identity edits in **ثيماتي** now propagate to the creator's explicitly linked drafts. Deletion resets those drafts to Bolt, and the confirmation explains that behavior. An explicit per-quiz customization creates a detached private revision. Published versions/live rooms and public themes copied by other creators remain frozen.
- `0008_link_owned_themes.sql` records owned-copy lineage. It backfills unchanged older copies only when artwork, labels, roles and presentation match an unambiguous earlier source; it does not guess from names. Customized or ambiguous legacy copies need explicit reassignment to the desired saved theme.
- The quiz creation overlap came from its sticky basics card sharing the footer's grid container. Removing that sticky positioning keeps the existing cards/columns/footer in normal flow, with no overlap at the end of scrolling.
- Creator JSON requests and major join/upload requests have deadlines. Failures release busy states and offer retries. Existing question editing waits for its data instead of exposing an empty editable form; failed loads cannot accidentally save a blank replacement.

## Verification

- Web: 53 tests passed. Worker: 51 tests passed. Workspace typecheck/lint and production build/static export passed.
- Added cache tests for deduplication, account isolation, stale response races, failed-request recovery, bounded session restoration and blocked storage. Added owned-theme propagation/reset and legacy-link migration tests; existing public-copy and frozen-version tests still pass.
- Browser tests used disposable local SQLite records and real Worker routes, with deliberately delayed list responses. Confirmed skeleton states, name search, standalone creation entry, edit propagation into a linked quiz, delete confirmation and reset to Bolt.
- Tested theme layouts at 320, 390 and 768 pixels with no horizontal document overflow. At a 1920-pixel viewport, scrolled to the true page bottom and verified the basics card and creation footer rectangles do not intersect.
- Also served the actual production static export locally: a full page reload caused a second auth check but no second identity-list request; navigating dashboard → themes reused the list immediately.
- Physical phone keyboards, native browser downloads and a full venue Wi-Fi session were not exercised in this review.

## Production

Applied migration 0008 to remote `brio-db` after verifying that `library_hidden` existed and `source_theme_id` did not. This installation's migration ledger predates the manually applied schema, so the reviewed SQL was executed directly instead of blindly applying all pending historical files.

The initial deployment was `ef7a4921-e216-4bde-891f-4220aedffabf`. Production health returned `status: ok`, `/identities/` returned HTTP 200, and the remote library query and source-theme column check succeeded. A final keyboard-search safeguard is deployed in the subsequent version recorded below. No production theme was edited or deleted during testing.

Final production version: 82aca155-e3de-4bbf-96a0-c7c4c5aa0aa6 (2026-10-25), including the keyboard-search safeguard.
