# Image Preview App

A React and Express image preview tool for uploading images, arranging them on a Konva canvas, applying basic transforms, cropping, exporting a PNG, and optionally uploading the result to Cloudinary.

## Requirements

- Node.js 20 or newer
- npm
- Optional Cloudinary account for cloud uploads

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
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CORS_ORIGIN=http://localhost:5173
```

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
npm run test:a11y
npm run test:e2e
npm run build
npm run lint
npm test
npm audit --omit=dev
```

See `docs/quality-gate.md` for the standard done checklist, and `docs/qa-baseline.md` for repeatable baseline and manual smoke checks.

## Runtime Storage

Uploaded and processed files are written under `backend/storage/uploads` and `backend/storage/processed`. These folders are ignored by git except for `.gitkeep` placeholders.

Clean processed files once:

```sh
npm run cleanup
```

Run scheduled cleanup:

```sh
npm run cleanup:watch
```

Cleanup defaults to files older than 24 hours and runs hourly. Override with `PROCESSED_MAX_AGE_MS` and `CLEANUP_CRON` when needed.
