# Deployment And Environment Reference

This is the supported production contract for the Vercel frontend and Render backend. Neon, Cloudflare R2, and SMTP are configured through the Render service.

Never commit real credentials. Use `.env.example` for names and hosting dashboards for values.

## Vercel

Project type: Vite static frontend.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Public HTTPS origin of the Render backend, with no trailing path |

Vercel settings:

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x
- SPA rewrites: provided by `vercel.json`

After changing `VITE_API_BASE_URL`, redeploy. Vite embeds it at build time.

## Render

Service type: Web Service with repository root directory `backend`.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Node version | 22.x |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check path | `/` |

Core variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `CORS_ORIGIN` | Yes | Comma-separated allowed frontend origins; include the production Vercel URL |
| `PORT` | Supplied by Render | Listener port; do not hard-code it |
| `HOST` | Optional | Defaults to `0.0.0.0`; keep this for Render port detection |

Free-tier services can cold-start. The 2026-07-17 live proof observed a first submission taking approximately 30 seconds or more, with no functional failure. Recheck latency on a warm instance before treating it as an application regression.

## Neon

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `POSTGRES_SSL` | Optional | Defaults to TLS with certificate verification disabled; set `false` only for a trusted local database |

The backend creates and upserts the `print_submissions` table. Use a least-privilege database role that can connect, create that table, and read/write its rows.

## Cloudflare R2

| Variable | Required | Purpose |
| --- | --- | --- |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3 API credential |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3 API secret |
| `R2_BUCKET` | Yes | Production print-package bucket |
| `R2_ACCOUNT_ID` | One of account ID or endpoint | Builds the standard R2 endpoint |
| `R2_ENDPOINT` | One of endpoint or account ID | Explicit S3-compatible endpoint |
| `R2_PREFIX` | Optional | Object-key prefix; defaults to `decal-sheet` |
| `R2_REGION` | Optional | Defaults to `auto` |
| `R2_PUBLIC_BASE_URL` | Optional | Base URL for direct file links; omit for a private bucket |

Objects are written under `<R2_PREFIX>/<projectId>/` as `print.pdf`, `preview.png`, `order.json`, and `project.json`.

## SMTP

| Variable | Required | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | Yes | SMTP relay hostname |
| `SMTP_PORT` | Optional | Defaults to `587` |
| `SMTP_SECURE` | Optional | Defaults from port; normally `false` for 587 and `true` for 465 |
| `SMTP_TIMEOUT_MS` | Optional | Connection/greeting/socket timeout; defaults to 15000 |
| `SMTP_USER` | Relay-dependent | Authentication username |
| `SMTP_PASS` | Relay-dependent | Authentication password |
| `PRINT_ORDER_EMAIL_FROM` | Yes | Sender address |
| `PRINT_ORDER_EMAIL_TO` | Yes | Comma-separated production recipients |
| `PRINT_ORDER_EMAIL_SUBJECT_PREFIX` | Optional | Defaults to `New decal sheet order` |
| `ADMIN_REVIEW_URL` | Recommended | Full admin URL included in order emails; defaults to the first `CORS_ORIGIN` plus `/admin` |

Set production `PRINT_ORDER_EMAIL_TO` to `orders@palmercodeworks.com,magicdecals@sunsignfactory.com`. If the relay requires authentication, configure both `SMTP_USER` and `SMTP_PASS`. Email status remains recorded in the order data while the local and durable print package remain available if delivery fails.

## Optional Cleanup

| Variable | Required | Purpose |
| --- | --- | --- |
| `PROCESSED_MAX_AGE_MS` | Optional | Processed-file retention; defaults to 24 hours |
| `CLEANUP_CRON` | Optional | Cleanup schedule; defaults to hourly |

## Retired Cloudinary Configuration

Cloudinary is not used by current runtime code. Remove these stale variables from Vercel, Render, local environment files, and any copied deployment templates:

- `VITE_CLOUDINARY_UPLOAD_PRESET`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_PROOF_FOLDER`

Historical Cloudinary entries in `docs/qa-notes.md` are retained only as an implementation record. They are not current setup instructions.
