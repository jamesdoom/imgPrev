# QA Notes

Keep this file short. Add one entry per meaningful change so future work can see what was checked and what remains risky.

## Template

```md
## YYYY-MM-DD - Short Change Name

- Automated: `npm run test:baseline`, `npm run test:e2e`
- Accessibility: `npm run test:a11y`
- Manual: upload/reload/admin review/mobile focus smoke check
- Regression added: file or test name
- Notes/follow-up: anything intentionally deferred
```

## 2026-07-01 - Quality Gate Created

- Automated: `npm run test:baseline`, `npm run test:e2e`
- Accessibility: `npm run test:a11y`
- Manual: not required; documentation/script change only
- Regression added: not applicable
- Notes/follow-up: continue adding focused regression tests whenever a bug is fixed

## 2026-07-01 - CI Quality Gate

- Automated: `npm run test:quality`
- Accessibility: `npm run test:a11y`
- Manual: not required; workflow/documentation change only
- Regression added: not applicable
- Notes/follow-up: GitHub Actions now runs the gate on pull requests and pushes to `main`

## 2026-07-01 - CI Install Follow-up

- Automated: `npm run test:a11y`, `npm run test:quality`
- Accessibility: covered by `npm run test:a11y`
- Manual: reviewed failed GitHub Actions run annotations and job step status
- Regression added: existing `backend/app.test.ts` no-manifest render test caught the Linux CI guard bug
- Notes/follow-up: updated workflow actions to Node 24 runtime majors, made the install step report npm failures, and repaired missing optional dependency entries in `package-lock.json`

## 2026-07-01 - Main Path Playwright Coverage

- Automated: `npm run test:a11y`, `npm run test:quality`
- Accessibility: covered by `npm run test:a11y`
- Manual: not required; browser regression coverage change only
- Regression added: `tests/e2e/customer-editor.spec.ts`, `tests/e2e/admin-review.spec.ts`
- Notes/follow-up: expanded browser coverage for upload, layout edits, order summary, proof submit payloads, reload persistence, admin downloads, and reject status updates

## 2026-07-01 - Data And File Reliability Hardening

- Automated: `npm run test -- src/components/ImageUploader/utils/getDpi.test.ts`, `npm run test -- src/components/ImageUploader/hooks/useImageUpload.test.ts`, `npm run test -- backend/app.test.ts`, `npm run test:a11y`, `npm run test:quality`
- Accessibility: covered by `npm run test:a11y`
- Manual: not required; parser, hook, and backend storage regression coverage change
- Regression added: malformed DPI metadata, DPI parser failure fallback, stale project JSON filtering, and missing generated project file handling
- Notes/follow-up: keep admin missing-file states visible while hiding malformed stale project folders
