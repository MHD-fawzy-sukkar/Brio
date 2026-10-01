# Brio — Staging & Free Cloud Pilot Runbook

**Date:** 2026-10-01  
**Target Architecture:** Cloudflare Worker + Static Assets + D1 Database + SQLite Durable Object (`GameRoomDO`) + Cloudinary Media.  
**Cloud Account ID:** `bd6f58d24f00498cd49284e83f994ac5`  
**D1 Database:** `brio-db` (`fcf6442e-ead1-4136-9660-21ab5206df3a`, WEUR region)

---

## 1. Cloud Provisioning & Deployment Status

### Completed Infrastructure Actions
1. **Remote D1 Database Creation:**
   - Command: `pnpm --filter @brio/worker wrangler d1 create brio-db`
   - Output: Created `brio-db` with UUID `fcf6442e-ead1-4136-9660-21ab5206df3a` in `WEUR` region.
   - Updated `apps/worker/wrangler.jsonc` with exact database ID binding.
2. **Remote D1 Schema Migrations:**
   - Command: `pnpm --filter @brio/worker wrangler d1 execute brio-db --remote --file=migrations/0001_initial_schema.sql`
   - Result: 17 D1 SQL queries executed successfully; 11 tables created (`creators`, `creator_sessions`, `quizzes`, `questions`, `question_options`, `short_answer_alternatives`, `media`, `quiz_versions`, `room_directory`, `archived_sessions`, `archived_player_results`).
3. **Static Assets Compilation & Upload:**
   - Command: `pnpm build && pnpm --filter @brio/worker wrangler deploy`
   - Result: Prerendered 10 static Next.js pages; 45 static assets uploaded to Cloudflare Workers Asset Storage (286.49 KiB).

---

### Required One-Time Account Initialization Step

> [!IMPORTANT]
> Cloudflare API returned error `10063`: `You need a workers.dev subdomain in order to proceed.`
> 
> **To complete the final script publication:**
> 1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) with account `Fawzy.sukkar2005@gmail.com`.
> 2. Open **Workers & Pages** in the left sidebar menu.
> 3. Click **Set up workers.dev subdomain** (or accept the default subdomain, e.g., `fawzysukkar.workers.dev`).
> 4. Re-run:
>    ```bash
>    pnpm --filter @brio/worker wrangler deploy
>    ```
> 5. Your deployment URL will be: `https://brio-worker.<subdomain>.workers.dev`

---

## 2. Secrets & Production Environment Configuration

Secrets must be populated securely using `wrangler secret put` before live events.

### Google OAuth Credentials Setup
```bash
# Set production Google OAuth Client ID
npx wrangler secret put GOOGLE_CLIENT_ID
```
- In Google Cloud Console: Add `https://brio-worker.<subdomain>.workers.dev` to Allowed Javascript Origins and Authorized Redirect URIs.

### Cloudinary Media Credentials Setup
```bash
# Set Cloudinary production keys for signed image uploads
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

---

## 3. Deployment & Rollback Runbook

### Deploying Updates
```bash
# 1. Build workspace & static export
pnpm build

# 2. Deploy updated Worker script + Assets
pnpm --filter @brio/worker wrangler deploy
```

### Rolling Back to a Previous Deployment
```bash
# Rollback Worker script to previous deployment version
npx wrangler rollback
```
*Note: Rolling back code does not alter D1 database data. Schema migrations are strictly additive.*

### D1 Database Backup & Export
```bash
# Export remote D1 data to local SQL file
npx wrangler d1 backup create brio-db
npx wrangler d1 export brio-db --remote --output=backup_brio_db.sql
```

---

## 4. Operational Retention & Free Plan Budget Limits

| Resource | Retention / Operational Limit | Free Tier Quota Policy |
| --- | --- | --- |
| **Active Room Data** | 24 hours in SQLite DO | Expired 24 hours after room event finishes |
| **Archived Quiz Results** | 30 days in D1 | Retained with CSV export; raw responses finited |
| **Worker Requests** | 100,000 requests / day | Free plan daily limit |
| **Durable Object Compute** | 100,000 request units / day | Inbound WebSocket ratio 20:1 request units |
| **D1 Storage Writes** | 100,000 rows written / day | 5 Million rows written / month max |
| **Cloudinary Media** | 25 Credits / month | Free plan credit allocation |
| **Pilot Seat Ceiling** | 200 seats total (including disconnected) | Pilot safety limit enforced by DO |
| **Active Rooms Ceiling** | Max 1 per creator, max 2 globally | Atomic D1 reservation limit |

---

## 5. Live Multi-Device Smoke Testing Checklist

Once the `workers.dev` subdomain is set in Cloudflare Dashboard:
1. Open `https://brio-worker.<subdomain>.workers.dev/login/` and log in with Google OAuth.
2. Build a 3-question test quiz with essential images and publish version 1.
3. Launch room $\rightarrow$ note 6-digit room PIN.
4. On 2 different mobile phones / browsers, open `https://brio-worker.<subdomain>.workers.dev/` and join using PIN.
5. Host starts game $\rightarrow$ observe sync, countdown, image prefetch, answer submission, score accumulation, leaderboard, and final podium.
