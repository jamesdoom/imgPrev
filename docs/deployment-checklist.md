# Deployment Checklist

Use this checklist for every production update.

## Before Merge Or Push

- Confirm the working tree contains only intended changes.
- Run `npm ci` when lockfile integrity is in doubt.
- Run `npm run test:client-ready`.
- Run `npm audit --omit=dev` and review actionable production findings.
- Confirm `.env.example` and `docs/deployment-environment.md` match the code.
- Confirm no credentials, customer artwork, generated PDFs, or project storage files are staged.
- Record database migrations or environment changes in the release notes.

## Environment Review

- Vercel `VITE_API_BASE_URL` points to the intended Render production service.
- Render `CORS_ORIGIN` includes the intended Vercel production origin and no obsolete preview origins.
- Render has the Neon, R2, and SMTP variables listed in `docs/deployment-environment.md`.
- Render start command is `npm start`, root directory is `backend`, and health path is `/`.
- Retired `CLOUDINARY_*` and `VITE_CLOUDINARY_*` variables are absent.
- Secrets are stored only in hosting dashboards or approved secret managers.

## Deploy

1. Push the release commit to `main`.
2. Wait for the GitHub Quality Gate to pass.
3. Confirm the Render deployment uses that commit and reports `Server listening on http://0.0.0.0:<PORT>`.
4. Confirm the Render health check returns HTTP 200.
5. Confirm the Vercel production deployment uses the same commit.
6. Open the customer and admin URLs in a private window.

## Post-Deploy Smoke Test

- Upload realistic artwork and confirm automatic placement.
- Confirm missing-DPI guidance is understandable.
- Submit one proof and record its project ID and total duration.
- Confirm the customer receipt appears.
- Confirm admin receives the same project.
- Open the production PDF and compare it with the proof preview.
- Confirm admin reports R2/Neon storage as stored.
- Confirm the print-order email is sent with the expected attachments.
- Exercise a review decision and confirm history updates.
- Check logs for unhandled errors or unexpected secrets/customer data.

## Rollback

Rollback when submission, PDF generation, admin retrieval, durable storage, or access control is broken.

1. Record the failing commit, project ID, time, and symptoms.
2. Redeploy the last known-good Render and Vercel versions.
3. Confirm both platforms now reference the same known-good commit.
4. Repeat the health check and a minimal submission smoke test.
5. Preserve failed order records and logs for diagnosis; do not delete customer data as part of rollback.
6. Fix forward with a regression test, then repeat the full checklist.

## Release Record

Capture:

- Release commit:
- GitHub Quality Gate URL:
- Render deployment URL/status:
- Vercel deployment URL/status:
- Smoke-test project ID:
- Submission duration:
- R2/Neon status:
- Email status:
- Reviewer:
- Known limitations:
- Rollback version:
