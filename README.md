# Image Preview App

A React and Express decal sheet tool for uploading artwork, arranging decals on a Konva canvas, exporting production files, and submitting a print-ready PDF for review.

## Requirements

- Node.js 20 or newer
- npm
- Optional Postgres database and Cloudflare R2 bucket for production submission storage
- Optional Cloudinary account for legacy proof mirroring

## Setup

Install frontend and shared backend dependencies from the project root:

```sh
npm install
```

The backend also has its own package manifest. If you run backend commands from `backend/`, install those dependencies too:

```sh
cd backend
npm install
```

Create a `.env` file in the project root for local configuration:

```sh
VITE_API_BASE_URL=http://localhost:4000
VITE_CLOUDINARY_UPLOAD_PRESET=frontend_unsigned
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
CORS_ORIGIN=http://localhost:5173

# Production print submission storage
DATABASE_URL=postgres://user:password@host:5432/database
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=your-r2-bucket
R2_PREFIX=decal-sheet
R2_PUBLIC_BASE_URL=https://files.example.com

# Optional legacy proof mirroring
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

`R2_ENDPOINT` can be used instead of `R2_ACCOUNT_ID` when you want to provide the full S3-compatible endpoint. `R2_PUBLIC_BASE_URL` is optional; omit it if the bucket is private and admins should access files through internal tooling.

## Development

Run the frontend:

```sh
npm run dev
```

Run the backend:

```sh
npm run dev:backend
```

Run both together:

```sh
npm run dev:all
```

The frontend defaults to `http://localhost:5173` and the backend defaults to `http://localhost:4000`.

## Validation

```sh
npm run test:baseline
npm run test:quality
npm run check:client-ready
npm run test:client-ready
npm run test:a11y
npm run test:e2e
npm run build
npm run lint
npm test
npm audit --omit=dev
```

See `docs/quality-gate.md` for the standard done checklist, `docs/qa-baseline.md` for repeatable baseline and manual smoke checks, and `docs/client-test-plan.md` for the client rehearsal walkthrough.

## Runtime Storage

Uploaded and processed files are written under `backend/storage/uploads` and `backend/storage/processed`. These folders are ignored by git except for `.gitkeep` placeholders.

Submitted print jobs are saved locally first so the customer receives a fast success response. When `DATABASE_URL` and the R2 variables are configured, the backend also stores `print.pdf`, `preview.png`, `order.json`, and `project.json` in Cloudflare R2 and records the submission in Postgres table `print_submissions`.

Clean processed files once:

```sh
npm run cleanup
```

Run scheduled cleanup:

```sh
npm run cleanup:watch
```

Cleanup defaults to files older than 24 hours and runs hourly. Override with `PROCESSED_MAX_AGE_MS` and `CLEANUP_CRON` when needed.
