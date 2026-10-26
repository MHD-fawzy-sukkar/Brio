# Creator themes and mobile UI review — 2026-10-25

## Delivered

- `/identities/` is now the **ثيماتي** library, linked from the dashboard and saved-theme picker. Owners can edit artwork, name, colors and visibility, or delete with confirmation.
- The studio supports choosing an owned or public theme alongside its existing identity editor and default-identity reset. Assignments copy the source and return the new identity ID. Public artwork remains design locked.
- Editing/deleting a library theme preserves attached quiz identities. Preserved/assigned snapshots stay out of the library to avoid duplicate cards after deletion.
- Export buttons keep a fixed label while image counts appear below them. Success appears in the same reserved area and clears after six seconds, with timer cleanup.
- `pageshow` resets starting indicators in the dashboard and studio after browser history restoration. While starting, other dashboard start buttons are disabled.
- Creation submits after identity selection on both desktop and mobile. Copy now describes the actual actions without promising automatic saves for manually saved identity/question edits.
- Mobile creator screens hide decorative roaming artwork that covered text. Image menus have larger touch targets, inputs use readable sizes, and confirmation dialogs scroll on short viewports.

## Verification

- Typecheck and lint: passed across all workspace packages.
- Production build: passed, including the static Next.js export and Worker compilation.
- Tests: 6 contracts, 9 game core, 48 web, 49 worker, 8 LAN (120 total) passed. LAN network tests required execution outside the network sandbox; the initial restricted attempt failed with loopback EACCES.
- Added integration coverage for public-theme studio assignment/reset, deletion preserving attached artwork without duplicate library entries, and transaction rollback when assignment fails.
- Browser inspection used a loopback-only preview with disposable SQLite data and the actual Worker routes. No production account data was used. The temporary preview server/script was removed after testing.
- Checked dashboard, creation (including the identity editor), studio, theme management/editor, question editor, login and join at phone widths starting at 320px; checked key editor layouts through 768px and 1440px. Sampled layouts had no horizontal document overflow.
- Visually checked the image/color menus, theme-delete dialog, studio theme selection, successful library edit, and export success/automatic disappearance. Export with a public theme included its image successfully.

## Release requirement and limits

Apply `apps/worker/migrations/0007_theme_library_snapshots.sql` before deploying the updated Worker/UI. It adds the library-hidden flag used for preserved quiz copies.

This is browser viewport testing, not physical iPhone/Android testing. Real-device Safari back/forward-cache behavior, native downloads/share UI, mobile keyboards and a full live game over venue Wi-Fi still need device acceptance. Gameplay timing, reconnect and media correctness are covered by the automated suites. These changes have not been deployed to production.

## Production schema repair — 2026-10-25

The live theme page reported `identity_setup_required`. Remote schema inspection confirmed that migrations 0004–0006 were already represented in the schema but `competition_identities.library_hidden` was missing. Applied only the additive SQL from 0007 using `wrangler d1 execute brio-db --remote --command`; the file-upload route failed before applying any changes. Verified the new INTEGER column/default and successfully executed the library read predicate against production. The `/identities/` HTML returned HTTP 200. An authenticated browser check was not completed because the in-app browser connection failed.

The remote migration ledger lists older files as pending despite their schema being present. Do not run all pending migrations blindly; reconcile that ledger against the existing schema before adopting the bulk migration command. No application redeployment was performed during this repair.
