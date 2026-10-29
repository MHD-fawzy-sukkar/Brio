# Project status

Updated: 2026-10-29.

Implemented: quiz and image authoring, competition identities, Arabic/English interfaces, live hosting, results, reconnect handling, LAN hosting and a Windows presenter application. Brio remains a limited pilot.

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
