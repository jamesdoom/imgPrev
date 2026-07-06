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

## 2026-07-02 - Editor Usability And Accessibility Polish

- Automated: `npm run test -- src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx`, `npm run test:a11y`, `npm run test:e2e`, `npm run test:quality`
- Accessibility: editor control names, descriptions, disabled reasons, and canvas guide status
- Manual: covered by mobile Playwright viewport check
- Regression added: `src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx`, `tests/e2e/customer-editor.spec.ts`
- Notes/follow-up: continue pairing visual polish with role/name based tests where browser behavior matters

## 2026-07-02 - Operational Confidence Polish

- Automated: `npm run test -- src/admin/adminReviewApi.test.ts src/admin/AdminReviewScreen.test.tsx`, `npm run build`, `npm run test:a11y`, `npm run test:e2e`, `npm run test:quality`
- Accessibility: admin history/status and error messaging remain covered by `npm run test:a11y`
- Manual: not required; admin workflow and warning cleanup covered by automated checks
- Regression added: admin API network/status errors, admin review save-error preservation, and Playwright admin history assertions
- Notes/follow-up: recurring canvas, Browserslist, and Playwright color warnings should stay quiet in the quality gate

## 2026-07-02 - Client Test Readiness Plan

- Automated: `npm run test:quality`
- Accessibility: covered by client checklist focus and disabled-state smoke checks
- Manual: documented in `docs/client-test-plan.md`
- Regression added: not applicable; documentation/readiness workflow change
- Notes/follow-up: run the client checklist with realistic artwork before the presentation session

## 2026-07-02 - First-Run UX Polish

- Automated: `npm run test -- src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx src/admin/AdminReviewScreen.test.tsx`, `npm run test:e2e`, `npm run test:quality`
- Accessibility: first-run customer guidance remains covered by editor accessibility checks
- Manual: not required; first-run copy and admin empty state covered by automated assertions
- Regression added: customer start-here guidance, automatic placement copy, and admin empty-state next action
- Notes/follow-up: run the client checklist with realistic files for final presentation rehearsal

## 2026-07-02 - Cloudinary Proof Mirroring

- Automated: `npm run test -- backend/app.test.ts`, `npm run test:quality`
- Accessibility: not applicable; backend proof storage change
- Manual: confirm a real submitted proof appears in Cloudinary under `decal-sheet/<projectId>` when credentials are configured
- Regression added: mocked Cloudinary upload stream verifies preview, PDF, manifest, review, project JSON, and original assets are mirrored
- Notes/follow-up: keep local backend project storage as the admin/recovery source while Cloudinary acts as the external proof mirror

## 2026-07-02 - Cloudinary Proof Smoke Command

- Automated: `npm run test -- backend/app.test.ts`, `npm run test:quality`
- Accessibility: not applicable; backend smoke tooling
- Manual: `npm run smoke:cloudinary` passed with `.env` credentials and uploaded the original visible test decals plus the rendered preview to `decal-sheet/project-20260702130758649-ngneym`; downloaded the Cloudinary preview URL and confirmed it is visibly rendered
- Regression added: Cloudinary mirror failures identify the failed file path and returned HTTP code
- Notes/follow-up: the smoke command creates a small Cloudinary test folder that can be deleted from Cloudinary after verification

## 2026-07-02 - Proof Submission Asset Verification

- Automated: `npm run test -- src/components/StickerSheetDesigner/renderProductionFiles.test.ts`, `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`, `npm run test:quality`
- Accessibility: not applicable; proof submission payload and receipt clarity change
- Manual: not required; browser coverage verifies the submitted Cloudinary folder and mirrored artwork names are shown after submit
- Regression added: multi-image proof payloads include the placed uploaded filenames, stale unplaced library artwork is omitted, and placed artwork without an original file fails before submission
- Notes/follow-up: actual Cloudinary submissions now show the returned folder and mirrored artwork names in the proof panel so the newest submitted project is easier to inspect

## 2026-07-02 - Cloudinary Submit Reliability

- Automated: `npm run test -- backend/app.test.ts`, `npm run smoke:cloudinary`, `npm run test:quality`
- Accessibility: not applicable; backend proof mirror reliability change
- Manual: real Cloudinary smoke uploaded to `decal-sheet/project-20260702153842668-4kj8pt`
- Regression added: core proof files still create a Cloudinary folder when an artwork copy upload fails; the response records a warning instead of losing the whole submission
- Notes/follow-up: Cloudinary artwork copies are optimized for review speed while original files remain stored in local project storage for admin/recovery

## 2026-07-02 - Cloudinary Smoke Folder Separation

- Automated: `npm run test -- backend/app.test.ts`, `npm run smoke:cloudinary`
- Accessibility: not applicable; proof mirror diagnostics change
- Manual: real Cloudinary smoke uploaded to `decal-sheet/_smoke/project-20260702154646504-5obekv`
- Regression added: backend returns an explicit `skipped` Cloudinary status when mirror credentials are missing
- Notes/follow-up: smoke submissions now write to `decal-sheet/_smoke/<projectId>` so test assets are not mistaken for real customer proof folders

## 2026-07-02 - Print Order Submission Foundation

- Automated: `npm run test -- src/domain/print/exportBundle.test.ts src/components/StickerSheetDesigner/renderProductionFiles.test.ts src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx src/admin/AdminReviewScreen.test.tsx backend/app.test.ts`, `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`, `npm run test:quality`
- Accessibility: submit action remains covered by editor accessibility checks with updated print submission copy
- Manual: verify the customer can submit for print and see the saved project receipt
- Regression added: print submissions write `order.json` alongside `print.pdf` without requiring extra customer detail fields
- Notes/follow-up: email delivery is intentionally marked `not-configured` until a provider and production recipient are selected

## 2026-07-06 - Print Handoff Receipt

- Automated: `npm run test -- src/components/StickerSheetDesigner/renderProductionFiles.test.ts src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx src/admin/adminReviewApi.test.ts src/admin/AdminReviewScreen.test.tsx src/admin/AdminReviewScreen.accessibility.test.tsx`, `npm run test:e2e -- tests/e2e/customer-editor.spec.ts tests/e2e/admin-review.spec.ts`; `npm run test:quality` printed passing lint, build, 154 unit tests, and 11 Playwright tests, then the wrapper hung during Playwright cleanup and was stopped
- Accessibility: admin file downloads use file-specific labels such as `Download PDF` and `Download order`
- Manual: verify a submitted sheet shows PDF, preview, and order record saved in the customer receipt and admin file list
- Regression added: customer receipt and admin review expose the saved print PDF, proof preview, and order record
- Notes/follow-up: keep using the generated PDF/order record as the print handoff foundation before adding email delivery

## 2026-07-06 - Print PDF Output Guardrails

- Automated: `npm run test -- backend/app.test.ts`, `npm run test:baseline`, `npm run test:e2e`
- Accessibility: not applicable; print-rendering backend guardrails
- Manual: not required for this structural guardrail; visually inspect a real client PDF before presentation
- Regression added: generated print PDFs must be one page, match sheet dimensions, and embed the rendered sheet at production pixel size
- Notes/follow-up: add visual PDF rendering smoke checks if the renderer starts adding marks, labels, or multi-page output

## 2026-07-06 - Quality Gate Cleanup

- Automated: `npm run test:e2e`, `npm run test:quality`
- Accessibility: not applicable; test runner cleanup fix
- Manual: confirmed no leftover Node/Vite process remains after the quality gate exits
- Regression added: Playwright runner now owns the Vite server lifecycle and shuts it down after browser tests
- Notes/follow-up: keep Playwright server startup in `scripts/runPlaywright.js` so local and CI quality gates use the same cleanup path

## 2026-07-06 - Submit Progress And Retry

- Automated: `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`
- Accessibility: submit progress uses `role=status`; failed submissions use `role=alert`
- Manual: not required; browser coverage verifies in-flight progress, inline retry guidance, and successful retry recovery
- Regression added: print submissions show preparing/uploading/finalizing progress and preserve the layout after a failed submit
- Notes/follow-up: keep Cloudinary/storage diagnostics secondary to the main print PDF and order record handoff
