# Project status

Updated: 2026-10-29.

Implemented: quiz and image authoring, competition identities, Arabic/English interfaces, live hosting, results, reconnect handling, LAN hosting and a Windows presenter application. Brio remains a limited pilot.

## Latest web update

The final verified publication on 2026-10-29 is Worker `d012154b-7b6f-4510-807a-1042b393a785`. The full quality pipeline passed. Public health returned HTTP 200; the published join, code-entry, player and question pages referenced JavaScript matching the verified build. The Windows 0.1.2-pilot download manifest retained its expected checksum and size. The repository also contains the final Arabic LinkedIn draft with the SDLC and Bolt sections.

This includes the rapid-click guards and durable browser request budgets first published as Worker `4b850202-5c66-4fd5-8b45-ea203a9a4738`. HTTP allows 30 requests per 10-second browser-cookie window across Cloudflare locations; socket messages are additionally limited per participant across connections. Tests cover 100-click/100-request bursts, 200 separate browser budgets behind one IP, counter recovery after restart, and normal 150-player gameplay. A bounded live health-only probe of that implementation allowed the bootstrap plus 29 requests, then returned HTTP 429 for the excess within 2.8 seconds. No real quiz or room was modified.

Automatic return from QR/code entry remains enabled: an uncached session check runs before name/avatar setup and valid sessions go directly to the current game. This was deployed as Worker `f79e2615-9d9e-47cd-8b15-085a3da6b1bc`.

This retains browser-session seat reuse and join-history replacement from Worker `5c9137f9-abe3-44df-b719-7ef7e3b4b44e`, tested with 100 repeated joins retaining one player and score.

This release retains the question-image remove button and persistent image removal from Worker `e92372f2-b2ff-4116-9071-28a5e29a29a5`. The Windows installer remains 0.1.2-pilot.

## Last recorded release

The project record documents publication and public download verification of Windows `0.1.2-pilot` on 2026-10-29. The installer is unsigned.

- Size: `35,478,528` bytes.
- SHA-256: `0ac9b00f6e7070928c2290e18656f3603c8d498f8689a47590c732f5fecb2c19`.
- Worker version: `a78c5bb8-25a5-47a2-bc1a-31d16b6c80ef`.

These are recorded verification results, not a fresh live-site check during documentation editing.

## Remaining acceptance work

- Physical Android and iOS phones on a real router with WAN disconnected and mobile data disabled, including background/resume and reconnect.
- Sustained venue-network measurement; 150 simulated local connections do not guarantee performance for 150 phones.
- A complete cloud rehearsal with real Google sign-in, Cloudinary upload and gameplay.
- Clean-Windows install, update and uninstall testing, plus a trusted signing/distribution channel.

Importing LAN results into the cloud with deduplication remains future work. Historical phase reports and screenshots are available in Git; maintained setup and operating instructions are in [Development](development.md) and [Operations](operations.md).
