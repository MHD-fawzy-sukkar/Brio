# Operations

## Host a LAN event

1. While online, prepare the quiz, wait for all image uploads to finish, and download its LAN package from the editor.
2. Download the Windows installer from the site's `/local/` page. Install it on the presenter laptop, open Brio, start the server and open the dashboard.
3. Import the quiz package in the local dashboard. Rehearse the questions and images before players arrive.
4. Connect the laptop and phones to the same network. Select the correct Wi-Fi adapter in the lobby; the QR must use the laptop's LAN address rather than `localhost`.
5. Players join in their browser without installing anything. Keep the presenter laptop awake and its server running until the game finishes.

After preparation, the game needs a reachable local network but no external Internet connection or Google login. The presenter dashboard is `http://localhost:3210/local/` on the laptop itself. Developers can run the same server from source; see [Development](development.md).

If a phone cannot connect, check the selected adapter, phone Wi-Fi, Windows private-network firewall permission and router client isolation. Changing the server hostname or IP changes the browser origin and may prevent resuming the previous player session.

## Data and backups

| Runtime                  | Location                                    |
| ------------------------ | ------------------------------------------- |
| Source checkout          | `.brio-lan/`; override with `BRIO_LAN_DATA` |
| Windows application data | `%LOCALAPPDATA%/Brio/data/`                 |
| Windows program versions | `%LOCALAPPDATA%/Brio/versions/`             |

The default LAN port is 3210; override with `BRIO_LAN_PORT`. Stop the server gracefully before copying its database for backup. Windows updates and uninstall retain application data. Do not include used event databases or private quiz packages in distributed installers.

The LAN importer validates the quiz version, schema and embedded image data before storing the package. Reimporting a quiz does not replace an already-created room's frozen content. Cloud synchronization of LAN results remains future work.

## Cloud deployment

Production requires Cloudflare bindings in `apps/worker/wrangler.jsonc` and Worker secrets: `GOOGLE_CLIENT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. Set them through Cloudflare Secrets or Wrangler's interactive secret command. Set the public `NEXT_PUBLIC_GOOGLE_CLIENT_ID` before building the frontend.

Before production schema changes, back up D1 and review pending migrations. Local migration commands do not update production. Rolling back Worker code does not restore earlier D1 data.

To verify and deploy the web application:

```powershell
pnpm quality
pnpm --filter @brio/worker exec wrangler deploy
```

When updating the Windows installer, run `pnpm lan:build` followed by `pnpm lan:desktop` before the cloud build and deployment. Packaging stages download parts in `apps/web/public/downloads/windows/`; the download endpoint streams them as one installer. Deploy the complete part set and manifest together. Retain the previous installer and a data backup.

After deployment, check the page, `/api/health`, actual sign-in and a complete game. For a Windows update, download through the public button and compare file size and SHA-256 with the built installer. Open browser tabs may need a full refresh after a release.

## Monitoring and distribution

During early events, monitor Worker/Durable Object errors, reconnects, HTTP 429 responses and D1/Cloudinary usage. Provider free plans still have finite quotas. Keep credentials, session tokens and private answers out of logs.

HTTP burst rejection returns 429 with `Retry-After` indicating the remaining window (up to 10 seconds); the entry/IP, auth and upload windows return `Retry-After: 60`. The durable browser budget is separate for each cookie, so a shared Wi-Fi address does not share the 30-request burst limit. The shared entry ceiling remains 1,200/minute/IP. Cookie rotation can obtain another browser budget, which is why broader entry limits remain in place. [Cloudflare's edge counters are approximate and local to each location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/); `RequestLimiterDO` supplies the shared browser counter. Incoming traffic still has a cost. Repeated clicking in the normal UI is also blocked before sending another request.

The Windows installer remains an unsigned pilot. It bundles Node.js for the presenter, installs per user and does not require Node or pnpm on player devices. A trusted signing/distribution channel and clean-Windows install/update/uninstall acceptance are still pending; do not ask users to disable Windows protection.

See [Project status](status.md) for the recorded release checksum and outstanding tests.
