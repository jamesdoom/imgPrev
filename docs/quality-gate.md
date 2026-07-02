# Quality Gate

Use this as the standard definition of done for changes to the app. Keep the gate boring, repeatable, and close to the risk of the change.

## Standard Done Checklist

- Code is scoped to the requested behavior and does not introduce unrelated feature work.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run test:a11y` passes when UI labels, controls, forms, landmarks, focus states, or layout structure changed.
- `npm run test:e2e` passes when upload, editor, save/reload, proof submission, admin review, or responsive browser behavior changed.
- The relevant manual smoke checks in `docs/qa-baseline.md` have been completed or intentionally skipped with a note.
- For client-facing test sessions, the walkthrough in `docs/client-test-plan.md` has been completed or intentionally scoped with a note.
- `docs/qa-notes.md` has a short entry for the change, including tests run, manual checks, and follow-up risks.

## One-Command Gates

GitHub Actions runs the automated gate on every pull request and every push to `main`.

Run the full automated quality gate:

```sh
npm run test:quality
```

This runs the existing baseline and browser smoke suite:

- `npm run test:baseline`
- `npm run test:e2e`

Run only axe-style accessibility checks:

```sh
npm run test:a11y
```

## Regression Test Rule

Whenever a bug is fixed, add the smallest focused regression test that would have failed before the fix.

Preferred placement:

- Domain bug: add or update a `src/domain/**.test.ts` test.
- API or persistence bug: add or update `backend/app.test.ts` or the matching API helper test.
- React control/state bug: add or update the closest component or hook test.
- Browser-only behavior: add or update a Playwright test in `tests/e2e`.
- Accessibility regression: add or update the relevant `*.accessibility.test.tsx`.

If a regression test is not practical, record the reason and the manual check in `docs/qa-notes.md`.

## Manual Smoke Checks

Run the checks most relevant to the change:

- Upload artwork and confirm metadata, thumbnail, and placement behavior.
- Move, resize, rotate, duplicate, delete, and undo/redo a selected decal.
- Toggle grid, spacing guides, proof overlays, and snapping.
- Reload the page and confirm saved artwork previews remain usable.
- Submit a proof request and confirm the admin review flow can open files and update review status.
- Tab through affected controls and confirm focus is visible and order is sensible.
- Check a narrow/mobile viewport for clipping, overlap, or unreachable controls.

## Baseline Warning Discipline

The gate should stay quiet enough that new warnings are easy to notice. When a recurring warning appears:

- Fix it in setup, configuration, or code when practical.
- If it cannot be fixed immediately, add a dated `docs/qa-notes.md` entry with the command, warning text, impact, and owner/follow-up.
- Do not add broad permanent exceptions for warnings without a specific follow-up.
