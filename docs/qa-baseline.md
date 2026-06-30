# QA Baseline

Use this checklist before starting reliability or polish work, and again before merging changes that affect customer, editor, or admin workflows.

## Automated Gate

Run the full baseline from the project root:

```sh
npm run test:baseline
```

This runs:

- `npm run lint` for static code quality.
- `npm run build` for TypeScript and production bundle validation.
- `npm run test` for unit, component, integration, backend API, and axe-style accessibility coverage.

Current baseline notes:

- The build may warn that Browserslist data is stale. Treat this as maintenance noise unless it becomes a failure.
- Vitest may log jsdom canvas `getContext()` warnings from canvas-backed components. Existing tests still pass, but quieter canvas setup is a good future cleanup.

## Existing Automated Coverage

- Domain logic: pricing, preflight, placement, layout, production profiles, upload rules, document history, and reducers.
- Customer UI: image uploader integration, sticker sheet workflow, and accessibility checks.
- Editor controls: transform, crop, export, keyboard shortcut, and accessibility coverage.
- Admin review: API client behavior, review screen behavior, project status updates, reviewer notes, and downloadable previews.
- Backend API: project submission, stored project access, review updates, and generated/downloadable file behavior.

## Manual Smoke Checks

Run these in a browser after the automated gate when UI behavior changed:

- Upload artwork, confirm thumbnail metadata appears, and place it onto the sheet.
- Move, resize, rotate, duplicate, delete, and undo/redo a selected decal.
- Toggle grid, spacing guides, proof overlays, and snapping without visual overlap or layout shift.
- Save or reload a project and confirm thumbnails/artwork previews remain available.
- Review order summary values, minimum order messaging, free shipping threshold, and submit readiness.
- Submit a proof request and verify the admin review screen can open previews, add notes, reject, approve, and change status.
- Check keyboard focus states and basic keyboard navigation through upload, editor, proof request, and admin controls.
- Resize to a narrow/mobile viewport and confirm controls remain usable without clipping.

## Step 1 Exit Criteria

- `npm run test:baseline` passes.
- Any warnings or manual issues are captured as follow-up work.
- No new feature work is introduced during the baseline pass.
