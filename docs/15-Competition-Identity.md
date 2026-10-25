# Competition identities

Implemented on `thems` and deployed on 2026-10-25. Live version: `64a0388b-d4f8-4a8c-83e7-dbb0f3e677c9`. Migration `0004_competition_identities.sql` was applied to the live D1 database after confirming both tables and the quiz column were missing.

## Scope and creator flow

Brio's navigation, colors and backgrounds remain fixed. The creator chooses Bolt defaults, a new custom theme, or a saved own/public theme on **/quizzes/new/** before creating the quiz, selects multiple images together and sets their roles. The creation request contains the identity draft; owned assets are validated before an atomic D1 batch inserts the identity and quiz. Existing quizzes retain identity editing in the builder. The dashboard has no separate identity library link; old `/identities/` bookmarks redirect to the dashboard. Identities provide a name, optional logo, optional replacement character and custom avatar catalog. Each identity requires 1–20 owned images. The editor has two special selectors: logo artwork is used only for logo placements, one other image can be the main character, and all non-logo images are avatars automatically. Legacy role combinations remain readable. New authoring uses an automatic catalog: fewer than five images with the avatar role supplements them with Bolt avatars; five or more exposes only custom avatars. The threshold is shared by the preview, picker and server admission validation. Legacy frozen modes remain readable. A logo-only identity can retain Bolt's character and player avatars.

The reusable editor includes a theme name, preview, image labels, two special role selectors, detail-color presets and private/public visibility. Uploads keep their original gallery position and card dimensions through completion; per-file checkboxes have been removed. The large player preview renders the actual selected avatar through the same Avatar component as runtime, and the main character is the initial avatar when available. In creation mode it renders a draft section inside the single creation form; existing quizzes use its save form. Avatar policy is automatic, without a selector. New quiz identities always fly automatically; there is no motion selector. Existing frozen snapshots retain their original representation for compatibility. Global marketing, creator pages and the app shell keep their original Brio artwork.

## Boundaries

- `packages/contracts/src/schemas/identity.ts`: validation, shared snapshot type, role-to-presentation resolver, permitted-avatar rules and image traversal/remapping. Authoring accepts asset IDs, not URLs.
- `apps/worker/src/routes/identities.ts`: isolated owner-authenticated routes with same-origin mutation checks and JSON errors. Authorization middleware is scoped to identity routes only.
- `apps/worker/src/repositories/identity.repository.ts`: asset ownership, identity persistence, atomic quiz assignment and soft deletion. Deleting unassigns drafts while published versions remain intact.
- `apps/worker/src/media/identity-upload.ts`: unique, non-overwriting signed Cloudinary uploads. Completion checks the creator namespace and verifies the Cloudinary response signature. URLs use an immutable version and a bounded transparent raster transformation. Existing quiz media behavior is unchanged.
- `apps/web/src/features/avatars/catalog.ts`: pure built-in avatar IDs, legacy compatibility and artwork variants, independent of React components.
- `apps/web/src/features/competition-identity/`: small editor, library, preview, quiz selector, API module, scoped context and presentation components.
- `apps/web/src/services/http-json.ts`: consistent same-origin JSON requests and error handling.

Quiz creation uses `POST /api/quizzes` with an optional owned-asset identity draft. Subsequent editing uses `GET /api/quizzes/:id/identity` to load its current record, `POST /api/quizzes/:id/identity` to atomically save a fresh identity revision and attach it, and `PUT /api/quizzes/:id/identity` to return to Brio defaults. Saving a new revision cannot change another quiz that previously referenced the same identity. Asset signing/completion endpoints remain separate. Owner-scoped legacy identity endpoints remain compatible but are no longer exposed as a global UI flow.

`useIdentityUploads` and `upload-batch.ts` handle multiple selected files with at most two uploads in flight, immediate local thumbnails, per-file failures/retry, cancellation and object-URL cleanup. Successful uploads survive failures elsewhere in the batch. Save is blocked while uploads are pending; editor metadata appears after the first successful upload. Initial builder rendering makes no identity-library request and shows no premature empty/error state.

JSON transport rejects HTML or malformed responses instead of treating them as empty identity data. Missing schema errors have a distinct setup response; GET failures use load-specific copy.

## Frozen rooms and join behavior

Publishing copies the resolved identity into the quiz version; room setup uses that frozen version. Host/player snapshots include only the public presentation. Pre-join `GET /api/rooms/:roomId/identity` exposes the frozen presentation without questions or host data. Join waits for that identity before showing available avatars. New player choices are validated against the room catalog, and returning players keep their saved identity. Editing or deleting the source identity does not change existing rooms or results.

`CompetitionIdentityProvider` is mounted around competition content only. Shared `Avatar` resolves stable custom avatar IDs inside that scope, while existing Bolt IDs and legacy saved images remain supported. Player setup repairs stale selections when catalogs change. Images use contain sizing to preserve their proportions. New uploads are normalized to a transparent 640×640 canvas: a bounded alpha scan trims transparent margins, then centers the artwork at 86% occupancy without stretching. Opaque backgrounds remain intact. Transparent-only images fail individually. Cloudinary square padding provides a server-side sizing fallback for browsers without canvas support. Existing frozen URLs remain unchanged.

## Motion

`MascotFlight` owns the DOM stage and pointer handlers; `useMascotFlight` owns movement, bounds, pointer capture, animation frames, visibility and reduced-motion handling. Generic `data-mascot-flight-root`, `data-mascot-flight-boundary` and optional `data-mascot-drag-root` attributes define geometry.

`RoamingBolt` supplies only its artwork and a stable pose callback for its face, hands and highlights. Custom images reuse the stage without anatomy-specific manipulation. Bolt uses full roaming flight again, including velocity, waypoints and drag momentum. Custom image characters alone use compact autonomous movement within ±6px horizontally and ±3px vertically around their anchor; dragging deliberately moves the anchor. Hero images float by at most 3px. Reduced-motion and visibility handling remain in place. Legacy `motion: 'still'` snapshots remain readable, while new quiz authoring always saves `float`. Movement applies to the whole image, not its facial features or limbs.

## LAN

Bundle format remains version 1 with optional identity data, so old bundles remain valid. Download collects and deduplicates question and identity images. Import validates all raster bytes/checksums and requires every referenced image, then rewrites logo, character and avatar URLs to local `/media/<hash>` paths. Room snapshots, pre-join presentation, avatar validation and saved results use the same shared identity contract.

Local cleanup counts identity references in imported quizzes and frozen rooms. Removing an imported quiz cannot discard images still used by a room; removing the last reference permits cleanup. Cloud identity assets are retained because published versions and historical rooms can reference them; physical Cloudinary garbage collection is outside this change.

## Verification and deployment

Integration tests use real SQLite with all four D1 migrations. They cover creator/asset isolation, auth/origin checks, assignment, archive, frozen versions and Cloudinary response verification. Durable Object tests cover identity cold wake, avatar admission and public snapshot redaction. LAN tests cover import/remapping, missing assets, media retention, custom joins, reconnect and frozen metadata. Web tests cover identity scope, default marketing artwork and compatibility. Production and LAN static builds pass.

The current suite passed 113 tests (5 contracts, 9 core, 46 web, 45 Worker, 8 LAN), including automatic catalog thresholds, image geometry and alpha cropping, compact motion bounds, create-time asset ownership and rollback of a failed quiz insert. Workspace TypeScript and production build passed. The LAN build is also checked; the identity format remains backward compatible.

Browser QA used an isolated loopback server and disposable in-memory database, selecting two public project PNG fixtures plus an intentionally invalid text file together. Both images uploaded through the real Cloudinary flow; the invalid file retained its own error without losing either successful image. Multiple selection and upload-first metadata were observed. The two newly created Cloudinary test assets were subsequently deleted by their exact isolated QA IDs. Atomic save/readback, rollback on DB failure, cross-quiz isolation and automatic motion were verified by integration tests.

The original live error was a deployed code/schema mismatch: neither identity table nor `quizzes.identity_id` existed. Remote metadata checks confirmed this, the additive migration was applied successfully, and the Worker/static assets were deployed together. Final probes returned health 200 JSON, unauthenticated identity endpoints 401 JSON, exact builder/legacy-route bundle hash matches, and the expected live schema names.

For future environments, ensure the identity migration is applied before publishing this code. The existing production database predates Wrangler migration tracking, so only the verified missing `0004` file was executed directly; do not blindly replay earlier ALTER migrations. Rebuild the LAN distribution when distributing updated creator/runtime code to a venue.

Cloudinary response verification follows [the official response-signature documentation](https://cloudinary.com/documentation/response_signatures).

## Create-time identity and 3D investigation (2026-10-25)

A second isolated, headless browser check used the production web build with mocked auth, uploads and quiz creation. It verified a single form, no initial error text, multiple uploads with independent invalid-file removal, actual 640×640 browser-encoded output, 17 choices for two custom avatars and exactly five choices at the threshold, no horizontal overflow at 390px, and an identity included in the creation POST. It did not create production records or upload assets externally. Repository integration tests separately verify real SQLite atomic persistence.

The character name is **Bolt (بولت)**; Brio is the product name. True 3D reconstruction is separate from CSS tilt. Investigated [TripoSR](https://github.com/VAST-AI-Research/TripoSR) (single-image mesh reconstruction, about 6GB VRAM with default inference settings) and [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) (tested on Linux, requires NVIDIA 24GB+). Read-only GPU inspection found an RTX 3050 Laptop with 4096MiB. No model inference was performed and no large dependencies or model weights were installed. The deployed fallback uses the requested very small hover range. A later true-3D experiment should generate a mesh offline, inspect the invented unseen surfaces against Bolt's artwork, then export a lightweight GLB for runtime rendering; arbitrary logos should not be automatically reconstructed without a preview.

Latest deployment verification: creation page 200, creation and shared identity JavaScript SHA-256 hashes exactly match the local cloud build, health 200 JSON, unauthenticated upload signing 401 JSON. Cloud and LAN builds both passed; the final deployed static output was rebuilt in cloud mode after checking LAN.

## Reusable themes, visibility and detail colors (2026-10-25)

Creation accepts either a new owned-asset `identity` or a readable `identityId`. `GET /api/themes` returns up to 100 own themes and 50 recent public themes to authenticated creators, excluding other creators' private/archived records and omitting creator account fields/input JSON. `PATCH /api/themes/:id/visibility` requires owner authentication and a valid mutation origin. The library offers own/public tabs and explicit publish/unpublish controls; no existing image is automatically published. New themes and reused copies default to private. Every saved quiz identity/revision remains available in its owner's library, so editing can produce multiple entries of the same name.

Migration `0005_theme_library.sql` adds visibility with a private default and a public-list index. It was applied after a read-only metadata check confirmed the column was absent. Reuse copies source URLs into fresh asset references and inserts assets, identity and quiz in one D1 batch. As of the latest permission clarification, foreign public copies are use-only: both the identity and its asset references are design-locked, while own themes remain editable via isolated private quiz revisions. Original edits, unpublishing or archiving cannot rewrite copies. A stale selection is rejected if the theme became private before authorization; public images are reusable by design and prior copies cannot be recalled by unpublishing.

Five enumerated color presets now apply throughout the competition scope: the larger logo/name header, primary buttons, panel borders/tints, brand text and avatar selection. They are inherited through a display-contents provider wrapper and cannot style the app shell outside that scope. Brio's shell, backgrounds and answer semantic colors stay fixed. The accent is part of frozen snapshots and the existing LAN image remapper preserves it. No arbitrary CSS or remote styles are accepted.

Browser QA on the cloud production build used mock auth, image upload/completion and theme endpoints. It verified full Bolt flight, no image role checkboxes, identical card width/height before and after upload, a logo excluded from avatars, the large avatar matching a clicked tile, a private creation payload containing the selected palette, own/public theme selection via `identityId`, and no horizontal overflow at 390px. All six temporary uploads stayed local. No production user/quiz/theme records were created by QA. Real SQLite tests independently verify private isolation, owner-only publication, cross-origin rejection, copied ownership, source archive independence and batch rollback including cloned assets.

Published Worker/static version `ced081d9-c9ca-4dd0-a6b8-d1fdfd2dba52`. Live probes: creation page 200, three creation/shared-feature bundle SHA-256 hashes match the local cloud build, health 200 JSON, unauthenticated theme library 401 JSON.

## Publication confirmation and use-only public designs (2026-10-25)

Theme mode selection uses three accessible cards instead of native radio dots. A shared publication dialog is used both when a new theme requests public visibility and when an owner publishes a saved theme. Cancel/Escape leaves the draft private and makes no visibility request. The API requires an explicit confirmation flag for public saves/visibility changes. Visibility controls appear only on owned entries in the own-library tab, never on the public tab. This confirmation concerns theme-library publication, not quiz-version publication.

A foreign public theme is usable but cannot be redesigned or re-published by its consumer. Migration 0006 adds design locks to identities and asset references. New foreign copies are locked; recognizable earlier copies are backfilled by their original Cloudinary creator namespace. Unknown legacy URLs are left unchanged rather than guessed. Locked copies are omitted from the consumer's editable library. Their own competition settings show a read-only preview and allow returning to Bolt; direct identity updates, quiz design edits, asset-ID repurposing and publishing are rejected server-side. The owner can still modify their own theme through a private competition revision. Quiz edits always save private and do not expose library publishing controls.

Library design updates also preserve all currently assigned quiz drafts in a separate private record before updating the library template; both operations run in one batch. Thus edits inside or outside a quiz do not rewrite other quizzes or frozen rooms. Visibility-only changes do not change design snapshots.

The logo is a larger branding header on join, host, player and results screens (plus preview); it is not used as a mascot or player avatar by the editor. Accent application is visibly broader while answer semantic colors and Brio's global backgrounds/navigation remain fixed. The existing dialog also gained focus placement, keyboard focus trapping, focus restoration and unique accessible label IDs.

Verification: 111 tests pass, including publication consent, direct API lock bypass attempts, template/draft isolation, legacy-lock migration, selection-card accessibility and confirmation wording. Cloud/LAN builds and TypeScript pass. An isolated headless browser verified cancel sends zero writes, confirmation sends exactly one flagged request, foreign themes expose no visibility controls, the locked builder exposes no character selector/save button, the logo pane is 80px tall, computed blue button/panel colors match the chosen accent, and no horizontal overflow appears at 390px. All browser data stayed on the loopback fixture server.

Latest release `0a264e4d-a56f-4aa0-87ee-98eac1b570b5` verified live: creation page 200, four JavaScript/CSS hashes exactly match the local cloud build, health 200 JSON and protected library 401 JSON. No production fixture identities or publications were created during verification.

## Responsive creation/join and LAN rehearsal (2026-10-25)

Creation separates basic information/cover from the theme editor in a wider desktop grid. The existing mode cards are retained; image and library galleries have desktop scroll bounds, preview panels are collapsible and the creation action remains visible. Name/upload and color/visibility controls share rows when space permits. The branding header uses a fixed positioned logo box and a wrapping text column with Arabic line-height padding, avoiding the previous image displacement and cramped name/credit columns. The join/PIN screens prioritize inputs and avatar selection on mobile, including a compact preview and mobile join action.

An actual browser exported a theme-bearing fixture through the builder, imported the generated file into the real LAN runtime and completed a question/game with a mobile browser through the LAN interface while external requests were blocked. Images, accent and branding survived import and reload; no external requests or failed local resources occurred. See docs/14-LAN.md for exact scope, limits and run instructions.

Responsive/offline follow-up deployed as `64a0388b-d4f8-4a8c-83e7-dbb0f3e677c9`. Four live pages returned 200; nine script/CSS hashes match the final cloud build, health 200. The final LAN output retains its runtime marker and contains no Google sign-in script. Final desktop review measured a 933px theme panel at 1440px with basic/theme cards aligned; long-name and logo geometry passed the mobile check.

## Compact image editing (2026-10-25)

The editor now stacks the theme name and upload area, eliminating the empty column beside the name. After selecting files the uploader becomes a compact toolbar. Uploaded images use the shared `Avatar` artwork and square picker frame in a bounded gallery; no repeated preview, caption fields, ready labels or role selectors are shown. Each tile has a three-dot action list for assigning/removing the main character or logo role and deleting the image. The main character has a star and accent border; the logo has a diamond and dashed amber border. Existing role exclusivity and logo exclusion from player avatars remain unchanged. Upload failures retain their retry/remove actions. The action list follows its trigger during scrolling, stays within the viewport, supports Escape and restores focus.

Cover images on creation and in the builder use a bounded positioned image with `object-fit: contain`, so portrait, landscape and square sources remain fully visible without changing the container's dimensions.

Validation: all 46 web tests, TypeScript and cloud/LAN production builds passed. Isolated Edge browser checks at 1600px and 390px exercised real browser image normalization with mocked upload endpoints, multi-file uploads, exclusive role reassignment, deletion, keyboard dismissal/focus, the actual creation request payload, 20-image capacity and last-tile menu placement. All three source aspect ratios stayed inside the cover frame without cropping or horizontal overflow. No production fixture records or external uploads were created.

## Additional and custom accents (2026-10-25)

The same 44px color control retains five quick swatches and adds a multicolor button. Its floating panel offers twelve presets, a native color picker and a validated six-digit HEX input. The panel renders above page stacking contexts, follows the field during scrolling and supports outside dismissal/Escape. Names, tooltips and selected marks identify swatches without increasing the control height.

Shared contracts accept the existing accent IDs, seven new preset IDs and strict `#rrggbb` custom values, normalized to lowercase. Values persist in the existing JSON identity records; no schema migration is required. Custom colors pass through library copies, frozen identity snapshots and LAN image remapping. Palette resolution derives a light tint and readable text/button foreground while retaining the exact selected accent. Existing preset colors and hover behavior remain intact.

Validation: 116 tests passed (6 contracts, 9 core, 47 web, 46 Worker, 8 LAN), plus workspace TypeScript and cloud/LAN production builds. New checks cover invalid CSS rejection, normalized color persistence and public-theme copies, LAN import, and foreground readability across 64 custom RGB samples. Isolated desktop/mobile Edge checks exercised all twelve presets, native picker events, invalid/valid HEX entry, focus restoration, portal visibility, unchanged 44px fields and a custom accent in the actual quiz-creation request. Browser writes/uploads were mocked and did not touch production data.
