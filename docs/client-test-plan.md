# Client Test Plan

Use this checklist when preparing the app for a client-led test session. The goal is to make the test easy to run, easy to repeat, and specific enough that feedback turns into actionable fixes.

## Test Session Goals

- Confirm the customer can upload artwork, place decals, understand warnings, and submit a print order.
- Confirm the admin reviewer can inspect submitted files, record a decision, and understand review history.
- Identify confusing copy, missing fallback states, layout issues, and any broken data/file paths before broader rollout.
- Capture feedback in a consistent format.

## Before The Session

- Run `npm run test:quality` and confirm it passes without recurring baseline warnings.
- Prepare 3 to 5 realistic artwork files:
  - A normal PNG or JPG with known dimensions.
  - A file with missing DPI metadata.
  - A vector/SVG file if the client expects vector uploads.
  - A low-resolution or warning-worthy image.
  - An unsupported file type for negative testing.
- Confirm the customer app and admin backend are running and reachable.
- If proof uploads should mirror to Cloudinary, confirm the backend has `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CLOUDINARY_PROOF_FOLDER=decal-sheet` configured. Run `npm run smoke:cloudinary` to submit a visible two-decal proof package under `decal-sheet/_smoke/<projectId>` and print the Cloudinary folder/URLs without exposing secrets.
- Clear local storage or use a fresh browser profile if you need a clean first-run experience.
- Keep `docs/qa-notes.md` open so any test deviation can be captured immediately.

## Customer Workflow

1. Open the customer editor.
2. Upload one normal artwork file.
3. Confirm the artwork thumbnail, dimensions, and DPI/fallback metadata are understandable.
4. Confirm the uploaded artwork is automatically placed on the sheet.
5. Duplicate or add at least one more decal.
6. Move, resize, rotate, duplicate, delete, and undo/redo a selected decal.
7. Toggle grid, spacing guides, proof overlays, and snap controls.
8. Review preflight messages and confirm warnings/errors explain the next action.
9. Review order summary: sheet count, price, minimum order, free shipping threshold, and submit readiness.
10. Reload the page and confirm artwork previews, placed decals, and order summary restore correctly.
11. Enter customer details and submit the sheet for print.
12. If Cloudinary mirroring is enabled, confirm the generated project appears under `decal-sheet/<projectId>` in Cloudinary.

Pass criteria:

- The next step is clear at each stage.
- No critical controls are hidden, clipped, or unreachable on desktop or mobile.
- Failed or unsupported uploads do not corrupt the current project.
- The print submission either succeeds or shows a recoverable error.

## Admin Workflow

1. Open the admin review screen.
2. Select the submitted project.
3. Confirm the proof preview, project JSON, manifest, print PDF, and original artwork links are visible or clearly marked missing.
4. Review production metadata, preflight issues, and file status.
5. Add reviewer name and note.
6. Submit an approve decision.
7. Confirm the review history shows current status, last update, latest reviewer, numbered decision, reviewer, and note.
8. Repeat with a reject or needs changes decision on a separate project if available.
9. Simulate or observe failed review update handling if the backend is unavailable.

Pass criteria:

- Reviewers can tell what has happened and who made the latest decision.
- Download/open links are understandable.
- Missing files and backend errors are explicit, not silent.
- Entered notes are preserved when a review update fails.

## Mobile And Accessibility Smoke

- Resize to a narrow viewport and complete upload, placement, order summary review, and proof submit readiness checks.
- Tab through upload, artwork list, view controls, selection controls, proof actions, and admin review controls.
- Confirm focus is visible and keyboard order follows the visual workflow.
- Confirm disabled controls explain why they are unavailable.

## Feedback Template

Use one entry per issue:

```md
## Issue Title

- Area: customer editor | admin review | upload | proof submit | mobile | accessibility
- Browser/device:
- Artwork file used:
- Steps to reproduce:
- Expected result:
- Actual result:
- Screenshot/video:
- Severity: blocker | high | medium | low
- Notes:
```

## Triage Rules

- Blocker: prevents print submission, corrupts project data, or blocks admin review.
- High: causes incorrect pricing, metadata, production file status, or reviewer decision state.
- Medium: confusing copy, awkward workflow, recoverable upload/admin errors, or layout friction.
- Low: visual polish, minor spacing, or non-blocking wording improvements.

## After The Session

- Add a dated summary to `docs/qa-notes.md`.
- Convert each blocker/high issue into a focused regression test before or during the fix.
- Re-run `npm run test:quality` after fixes.
- Re-run this client checklist before the next client test session.
