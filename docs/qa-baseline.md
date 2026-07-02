# QA Baseline

Use this checklist before starting reliability or polish work, and again before merging changes that affect customer, editor, or admin workflows.

For the standard definition of done, use `docs/quality-gate.md`.

For data and file reliability work, pair this checklist with `docs/data-file-paths-audit.md`.

Before a client-led test session, run the structured walkthrough in `docs/client-test-plan.md`.

## Automated Gate

Run the full baseline from the project root:

```sh
npm run test:baseline
```

This runs:

- `npm run lint` for static code quality.
- `npm run build` for TypeScript and production bundle validation.
- `npm run test` for unit, component, integration, backend API, and axe-style accessibility coverage.

Run browser smoke checks when customer, editor, or admin workflows change:

```sh
npm run test:e2e
```

This runs Playwright checks against a real Chromium browser.

Run the full automated quality gate before merging broad UI or workflow changes:

```sh
npm run test:quality
```

Run focused accessibility checks when labels, controls, landmarks, focus states, or layouts change:

```sh
npm run test:a11y
```

Current baseline notes:

- Baseline commands should not emit recurring expected warnings. Capture any new repeated warning in `docs/qa-notes.md` with the command, impact, and follow-up.

## Existing Automated Coverage

- Domain logic: pricing, preflight, placement, layout, production profiles, upload rules, document history, and reducers.
- Customer UI: image uploader integration, sticker sheet workflow, and accessibility checks.
- Editor controls: transform, crop, export, keyboard shortcut, and accessibility coverage.
- Admin review: API client behavior, review screen behavior, project status updates, reviewer notes, and downloadable previews.
- Backend API: project submission, stored project access, review updates, and generated/downloadable file behavior.
- Browser smoke tests: customer artwork upload/reload, print submission readiness, and admin review decision controls.

## Manual Smoke Checks

Run these in a browser after the automated gate when UI behavior changed:

- Upload artwork, confirm thumbnail metadata appears, and place it onto the sheet.
- Move, resize, rotate, duplicate, delete, and undo/redo a selected decal.
- Toggle grid, spacing guides, proof overlays, and snapping without visual overlap or layout shift.
- Save or reload a project and confirm thumbnails/artwork previews remain available.
- Review order summary values, minimum order messaging, free shipping threshold, and submit readiness.
- Submit a print order and verify the admin review screen can open previews, add notes, reject, approve, and change status.
- Check keyboard focus states and basic keyboard navigation through upload, editor, print submission, and admin controls.
- Resize to a narrow/mobile viewport and confirm controls remain usable without clipping.

For client presentation readiness, use `docs/client-test-plan.md` instead of this shorter smoke list.

## Step 1 Exit Criteria

- `npm run test:baseline` passes.
- Any warnings or manual issues are fixed or captured as dated follow-up work.
- No new feature work is introduced during the baseline pass.
