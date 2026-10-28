# Windows release and repository cleanup — 2026-10-28

## What was actually published

The refreshed identity settings card and LAN dashboard were published to the existing Cloudflare Worker as version `5e2ef225-6f30-4fd2-83a4-fb18dc4ba3b8`. The live builder JavaScript and CSS were downloaded and compared byte-for-byte with the verified cloud export. A page already open before deployment requires a full refresh.

## Windows 0.1.2 pilot

The presenter and installer share native rounded-button styling. The installer has the Brio mascot, a short preparation guide, extraction progress and a visible version. The controller keeps diagnostics collapsed and shows the actual server state. Installation asks the user to close an existing Brio instance rather than opening the new version behind an old running instance. This release remains unsigned.

- Local installer: `releases/Brio-LAN-Setup-0.1.2.exe`.
- Bytes: 35,478,528.
- SHA-256: `0ac9b00f6e7070928c2290e18656f3603c8d498f8689a47590c732f5fecb2c19`.
- Eight static parts: seven of 4.5 MiB and a final 2,448,384-byte part. Local reconstruction matches the complete installer exactly.
- Screenshots: `desktop-setup-0.1.2.png`, `desktop-ready-0.1.2.png`.

Verification passed: .NET Framework compilation; hidden installer rendering; actual native Start/health/Stop/details controls against an isolated server; extracted bundled runtime; graceful shutdown and restart with persisted quiz data; architecture/format checks; both download route tests. No installation into the user's account and no full clean-Windows uninstall test were performed.

## Removed files

After explicit user approval of the reviewed list, 73 superseded release/build/test-output/log entries were deleted from `releases`: 2,971,613,334 bytes. Six obsolete copies of generated download parts were also removed from `apps/web/public/downloads/windows`: 212,049,408 bytes. The tracked root `.next/trace` was removed and `.next/` is now ignored.

Preserved: the current installer and previous installer, current package/publish assets, the root LAN database, every directory flagged as containing a database, the pre-migration SQL backup and schema/baseline records. Dependencies, operational documentation, tests and application source were retained where usage is established or uncertain. No source module was deleted merely because its filename appeared old.

## Deployment transport

Small web assets uploaded successfully while bulk installer uploads repeatedly reset. Longer process-local connection timeouts helped diagnosis; TLS verification, credentials, VPN and firewall settings were not weakened or changed. Uploading one binary part into an undeployed Worker version succeeded. Remaining parts are staged independently; such asset-only versions must never be promoted to live traffic. Only the complete cloud asset manifest may be deployed.

The public installer must be considered old until the final manifest is activated and the downloaded binary has been checked against the SHA-256 above.
