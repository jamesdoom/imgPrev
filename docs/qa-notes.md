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

## 2026-07-06 - Quiet Customer Storage Details

- Automated: `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`, `npm run test:quality`
- Accessibility: not applicable; customer receipt wording only
- Manual: verify a submitted proof receipt focuses on the print PDF, proof preview, and order record without listing Cloudinary folder or mirrored artwork names
- Regression added: customer browser coverage confirms routine Cloudinary storage details stay hidden after submit
- Notes/follow-up: customer receipts still show storage warnings when the backend reports an actionable storage issue

## 2026-07-06 - Admin Print Handoff Readiness

- Automated: `npm run test -- src/admin/AdminReviewScreen.test.tsx`, `npm run test:e2e -- tests/e2e/admin-review.spec.ts`, `npm run test:quality`
- Accessibility: admin handoff summary uses a labelled section heading and text status for readiness
- Manual: verify the admin detail view clearly identifies the PDF as the print file before client testing
- Regression added: component and browser coverage confirm the Print handoff panel appears with ready status when PDF, preview, and order record files exist
- Notes/follow-up: use `docs/client-test-plan.md` for a final rehearsal with realistic artwork before sharing the app with the client

## 2026-07-06 - Client Readiness Rehearsal Gate

- Automated: `npm run check:client-ready`, `npm run test:client-ready`
- Accessibility: not applicable; readiness command and documentation workflow only
- Manual: use the command output to start the final client rehearsal from the quality gate, client walkthrough, and QA notes
- Regression added: readiness script fails when the client walkthrough, quality gate, QA baseline, QA notes, or required npm scripts drift out of place
- Notes/follow-up: run the full client walkthrough with realistic artwork and record findings here before inviting client testers

## 2026-07-07 - Application Instructions Help

- Automated: `npm run test -- src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx`, `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`, `npm run test:client-ready`
- Accessibility: application instructions open in a labelled dialog with Escape close behavior and a text-first instruction summary
- Manual: confirm the PDF download opens the client-provided application instruction sheet from the modal
- Regression added: customer browser coverage verifies the post-submit instructions link, dialog content, and downloadable PDF path
- Notes/follow-up: keep the instructions in collapsed Project tools and the receipt so the main editor remains focused on sheet design

## 2026-07-07 - Faster Print Submission Handoff

- Automated: `npm run test -- backend/app.test.ts`, `npm run test:client-ready`, `npm run build` from `backend/`
- Accessibility: not applicable; backend submit performance and storage behavior only
- Manual: submit a realistic sheet and confirm the customer receives the saved PDF/order receipt before Cloudinary mirroring finishes
- Regression added: backend coverage verifies Cloudinary starts as queued, runs after the local proof is saved, records failures without failing submission, and mirrors only the preview PNG plus print PDF
- Notes/follow-up: prefer the local PDF/order handoff or simpler file storage for production; keep Cloudinary out of the customer-critical submit path

## 2026-07-07 - Postgres And R2 Production Storage

- Automated: `npm run test -- backend/app.test.ts`, `npm run test:client-ready`
- Accessibility: not applicable; backend storage migration only
- Manual: configure `DATABASE_URL` and Cloudflare R2 variables in the deployed backend, submit a realistic sheet, and confirm `print.pdf`, `preview.png`, `order.json`, and `project.json` are stored under `R2_PREFIX/<projectId>` with a matching `print_submissions` row
- Regression added: backend submission records Postgres/R2 as queued or skipped without delaying the customer success response, and async storage updates preserve other background status fields
- Notes/follow-up: Postgres plus R2 is the production storage path; Cloudinary should stay out of the print submission flow

## 2026-07-08 - Admin Production Storage Status

- Automated: `npm run test -- src/admin/AdminReviewScreen.test.tsx src/admin/AdminReviewScreen.accessibility.test.tsx src/admin/adminReviewApi.test.ts backend/app.test.ts`, `npm run test:e2e -- tests/e2e/admin-review.spec.ts`
- Accessibility: storage checklist uses valid description-list markup and remains covered by admin axe checks
- Manual: after a live submit, verify the admin detail view shows `Production files stored` with PDF, preview, order, and project record statuses
- Regression added: admin API, component, accessibility, backend, and browser tests cover the Postgres/R2 storage status panel
- Notes/follow-up: consider adding admin download/open links for private R2 files through signed URLs if direct dashboard access becomes too cumbersome

## 2026-07-08 - Cloudinary Cleanup

- Automated: `npm run test -- backend/app.test.ts src/components/StickerSheetDesigner/renderProductionFiles.test.ts src/components/ImageUploader/ImageUploader.accessibility.test.tsx`, `npm run build`, `npm run build` from `backend/`
- Accessibility: legacy image editor still exposes the download control and remains covered after removing the cloud-upload button
- Manual: submit a realistic sheet from the deployed app and confirm the receipt appears quickly while R2 receives `print.pdf`, `preview.png`, `order.json`, and `project.json`
- Regression added: backend and browser mocks now treat Postgres/R2 as the only production storage integration
- Notes/follow-up: remove stale `CLOUDINARY_*` and `VITE_CLOUDINARY_*` variables from hosting dashboards after the deployment is verified

## 2026-07-14 - Print Order Email Delivery

- Automated: `npm run test -- backend/app.test.ts`, `npm run build`, `npm run build` from `backend/`
- Accessibility: not applicable; backend email delivery only
- Manual: configure SMTP and `PRINT_ORDER_EMAIL_*` variables in Render, submit a realistic sheet, and confirm the recipient receives the print PDF, preview PNG, and order JSON
- Regression added: backend coverage verifies configured SMTP queues email, sends the print package attachments, and updates `order.json` to `sent`
- Notes/follow-up: keep email delivery background-only so customer submit speed still depends on local file save, not SMTP latency

## 2026-07-14 - CI Lockfile Peer Sync

- Automated: `npm ci --no-audit --no-fund`, `npm run test:client-ready`
- Accessibility: covered by the full client-ready gate
- Manual: confirm the pushed Quality Gate run gets past the `npm ci` install step
- Regression added: lockfile now includes npm 11 peer dependencies required by `@napi-rs/wasm-runtime`
- Notes/follow-up: keep GitHub Actions as the authority for npm 11 behavior because local Windows uses npm 10

## 2026-07-14 - SMTP Delivery Status Timeout

- Automated: `npm run test -- backend/app.test.ts`
- Accessibility: not applicable; backend email delivery status only
- Manual: submit a live proof through Render/Brevo and confirm `order.json` moves from `queued` to either `sent` or `failed`
- Regression added: backend coverage verifies failed SMTP delivery writes a `failed` email status to `order.json`
- Notes/follow-up: Brevo should use `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`

## 2026-07-14 - Admin Print Handoff Polish

- Automated: `npm run test -- src/admin/AdminReviewScreen.test.tsx src/admin/AdminReviewScreen.accessibility.test.tsx`, `npm run test:e2e -- tests/e2e/admin-review.spec.ts`
- Accessibility: admin handoff remains covered by axe-style admin screen coverage
- Manual: verify the admin detail page answers "What do I print?" with the print PDF as the primary action before metadata and supporting files
- Regression added: component and browser coverage assert the primary print PDF action, visual-reference preview copy, status history, and supporting files section
- Notes/follow-up: keep production storage and JSON/artwork links available, but visually secondary to the PDF handoff

## 2026-07-15 - Customer Proof Receipt

- Automated: `npm run test:e2e -- tests/e2e/customer-editor.spec.ts`, `npm run test:client-ready`
- Accessibility: receipt is announced as a labelled status region after successful submit
- Manual: submit a realistic sheet and confirm the receipt calmly shows the project ID, saved print PDF/preview/order/project files, and the next review step
- Regression added: customer browser coverage asserts the submitted receipt, project ID, saved-file checklist, next-step copy, and failed-submit recovery
- Notes/follow-up: keep operational warnings conditional so the success state stays minimal for customers

## 2026-07-17 - Client Testing Package

- Automated: `npm run check:client-ready`
- Accessibility: not applicable; client-facing documentation only
- Manual: reviewed the copy-ready email for URL placeholders, realistic artwork guidance, customer/admin steps, feedback capture, and severity definitions
- Regression added: readiness document check now requires `docs/client-test-script.md`
- Notes/follow-up: replace bracketed links/access details before sending; use the longer test plan for internal QA

## 2026-07-17 - Admin Handoff Polish Round Two

- Automated: `npm test -- src/admin/AdminReviewScreen.test.tsx src/admin/AdminReviewScreen.accessibility.test.tsx backend/app.test.ts`
- Accessibility: admin review accessibility suite
- Manual: verified the print PDF is the dominant action, storage and email delivery have explicit states, technical metadata is visually secondary, and newest review decisions scan first
- Regression added: admin API responses now expose the persisted email delivery record; component and backend tests cover sent email status and the revised print/history hierarchy
- Notes/follow-up: live delivery remains part of the pending Phase 2 production proof

## 2026-07-17 - Customer Flow Friction Pass

- Automated: `npm test -- src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx` and `npm run test:e2e`
- Accessibility: customer editor accessibility suite
- Manual: reviewed the empty upload state, automatic-placement confirmation, Auto-arrange disabled state, customer-facing preflight language, primary submit action, receipt, and application-instruction entry point
- Regression added: browser and accessibility coverage assert the calmer first-run copy, automatic placement guidance, renamed Auto-arrange action, disabled production explanation, and post-submit instructions
- Notes/follow-up: backend email/storage diagnostics now stay in admin instead of appearing on the successful customer receipt

## 2026-07-17 - Production Reliability Checks

- Automated: focused 61-test reliability suite plus `npm run test:client-ready`
- Accessibility: covered by the full client-ready gate
- Manual: reviewed large uploads, missing DPI, render/PDF failure, R2/Neon failure, SMTP failure, stale saved projects, and admin API errors against `docs/production-reliability-checks.md`
- Regression added: route-specific 25 MB render limit messaging, persisted background storage failure with intact local PDF/order files, and controlled admin-list HTTP 500 response
- Notes/follow-up: fixed two issues found—the wrong size-limit message on render routes and an unhandled admin-list filesystem failure

## 2026-07-17 - Render Port Binding Hotfix

- Automated: `npm test -- backend/serverConfig.test.ts`, backend TypeScript build, and full root build
- Accessibility: not applicable; backend listener configuration only
- Manual: confirmed Render provides `PORT=10000` and the server now listens on `0.0.0.0:10000`
- Regression added: server binding test requires the default host to remain `0.0.0.0` and validates configured/fallback ports
- Notes/follow-up: the failed deploy built successfully but timed out because the previous listener omitted the public host binding

## 2026-07-17 - Live Submission Proof

- Automated: covered by the existing client-ready gate
- Accessibility: covered by the deployed customer/admin workflow
- Manual: production operator confirmed receipt, admin project, Print PDF, R2 files, Neon order, and email delivery
- Regression added: live proof record is now required by `npm run check:client-ready`
- Notes/follow-up: submission took approximately 30 seconds or more, likely due to free-tier cold start; compare with a warm submission before opening a performance defect

## 2026-07-17 - Deployment And Environment Audit

- Automated: `npm run test:client-ready`, backend build, and readiness document checks
- Accessibility: unchanged; deployment documentation and runtime metadata only
- Manual: audited Vercel, Render, Neon, R2, SMTP, CORS, listener, cleanup, and retired Cloudinary variables against current code
- Regression added: readiness check requires the environment reference, deployment/rollback checklist, and live proof record
- Notes/follow-up: remove the six retired Cloudinary variables listed in `docs/deployment-environment.md` from hosting dashboards and ignored local `.env` files

## 2026-07-17 - Client Feedback Loop Setup

- Automated: `npm run test:client-ready`
- Accessibility: covered by the full client-ready gate; no UI behavior changed
- Manual: reconciled the completed live proof with the feedback queue and confirmed no client defects have been reported
- Regression added: readiness checks now require the client feedback register and release-candidate gate
- Notes/follow-up: the approximately 30-second first submission is tracked as a cold-start observation, not a confirmed defect; capture cold and warm timings during the next client session

## 2026-07-20 - Durable Admin Order Recovery

- Automated: focused backend regression plus `npm run test:client-ready`
- Accessibility: unchanged; admin API persistence and stored-file delivery only
- Manual: traced the production empty-list report to the admin API reading Render-local project folders even though Neon/R2 held the durable order
- Regression added: a Neon-backed order remains listed, opens in detail, accepts a review decision, and exposes its R2 print PDF after the local project folder disappears; background JSON status updates are serialized and replaced atomically
- Notes/follow-up: CLIENT-20260720-01 remains a blocker in ready-for-retest state until the fix is deployed and the client confirms the order survives the original wait/refresh sequence

## 2026-07-20 - SVG Preflight DPI Classification

- Automated: focused preflight regression plus `npm run test:client-ready`
- Accessibility: customer artwork readiness language remains covered by the existing editor accessibility and browser suites
- Manual: traced the below-150-DPI message to raster DPI validation running before robust SVG classification
- Regression added: SVG artwork is exempt from raster DPI thresholds when identified by MIME type or `.svg` filename, even if stale DPI metadata is present
- Notes/follow-up: CLIENT-20260720-02 remains a blocker in ready-for-retest state until the deployed app identifies the reported SVG as vector artwork

## 2026-07-20 - Placed-Size Effective DPI

- Automated: focused effective-DPI and editor accessibility tests plus `npm run test:client-ready`
- Accessibility: preflight retains explicit warning/error language and suggests making the decal smaller
- Manual: inspected `arizona_diamondbacks.png` as 905 × 720 px with embedded 72 DPI and confirmed that its actual print DPI varies with placed size
- Regression added: the reported image calculates to approximately 181 effective DPI at 5 inches wide and approximately 148 effective DPI at 6.1 inches wide
- Notes/follow-up: CLIENT-20260720-03 remains a blocker in ready-for-retest state until resizing the deployed decal updates or clears its DPI issue correctly; the full gate also verified Windows-safe atomic status-file replacement from the preceding admin durability fix

## 2026-07-20 - Keyboard Delete Artwork Cleanup

- Automated: focused Chromium deletion regression plus `npm run test:client-ready`
- Accessibility: Delete and the visible Delete selected control now share the same cleanup behavior
- Manual: confirmed the old shortcut removed only the placed item and deliberately retained its source in the artwork library
- Regression added: deleting the last placed decal removes its unused artwork row; deleting one of multiple placed copies preserves the reusable source
- Notes/follow-up: CLIENT-20260720-04 remains a blocker in ready-for-retest state until the deployed keyboard workflow removes the reported stale row

## 2026-07-20 - Canvas Resize Normalization

- Automated: focused successive-transform regression plus `npm run test:client-ready`
- Accessibility: unchanged; numeric size controls remain available as the keyboard-accessible resize path
- Manual: traced intermittent resize jumps to Konva retaining imperative scale after the app had already absorbed that scale into stored width and height
- Regression added: resize commit resets node scale to one, preserves center/minimum size, and guarantees a following inward transform decreases dimensions
- Notes/follow-up: CLIENT-20260720-05 remains a blocker in ready-for-retest state until repeated small inward/outward handle drags behave consistently in production

## 2026-07-20 - Auto-Arrange Action Emphasis

- Automated: customer browser workflow plus `npm run test:client-ready`
- Accessibility: enabled state keeps high-contrast text and existing focus treatment; disabled state remains visually subdued with explanatory copy
- Manual: changed Auto-arrange from a neutral secondary button to a distinct blue action
- Regression added: the customer proof workflow verifies the enabled Auto-arrange visual treatment before using it
- Notes/follow-up: multi-sheet overflow is intentionally separate because it must coordinate layout, pricing, PDFs, persistence, submission, and admin review

## 2026-07-20 - Confirmed Multi-Sheet Overflow

- Automated: placement, document/export, backend render/submission, admin review, and customer browser regressions plus `npm run test:client-ready`
- Accessibility: overflow confirmation states the exact number of decals and next sheet before price changes; sheet headings and per-sheet preflight remain visible without relying on color
- Manual: verified Sheet 1 is packed first, cancellation leaves the document and price unchanged, confirmation creates the next numbered sheet, and wide layouts show sheets side by side while smaller layouts stack them
- Regression added: overflow packing, legacy one-sheet compatibility, multi-page PDF generation, numbered R2 previews, Neon sheet/file metadata, all-sheet admin links, sheet-count pricing, and the customer confirmation workflow
- Notes/follow-up: CLIENT-20260720-07 remains ready for deployed retest; admin receives one multi-page `print.pdf` plus a numbered preview for every sheet

## 2026-07-20 - CI Browser Timing Stabilization

- Evidence: GitHub Actions run log archive `logs_80577952876.zip`
- Cause: the Delete regression sent its shortcut before the asynchronously placed decal was selectable, while the submission regression allowed its mocked response to replace the transient progress panel before a loaded CI worker observed it
- Correction: wait for the selected-item Delete control to become enabled and keep the mocked submission pending long enough to assert the uploading state
- Automated: both affected Chromium scenarios passed five consecutive parallel repetitions; `npm run test:client-ready` then passed with 160 automated tests and 14 browser tests
- Notes/follow-up: SMTP, R2, storage-volume, and upload error messages in the archive were expected output from passing failure-path tests, not production-service failures

## 2026-07-20 - Newest-Sheet Upload Destination

- Manual: traced Add more artwork placement to the active sheet and found Auto-arrange explicitly restored Sheet 1 after creating overflow sheets
- Correction: Auto-arrange now activates its last created sheet, making that newest sheet the destination for the next upload
- Regression added: the multi-sheet Chromium workflow records Sheet 2's decal count, uploads more artwork, and verifies only the Sheet 2 count increases
- Notes/follow-up: CLIENT-20260720-08 remains ready for deployed retest

## 2026-07-20 - Immediate Empty-Sheet Cleanup

- Evidence: client screenshot showed Sheet 1 still occupying half of the wide-screen sheet grid after Sheet 2 was emptied
- Cause: sheet metadata was only rebuilt by Auto-arrange, and the responsive grid always enabled two desktop columns
- Correction: both placed-item deletion and last-artwork deletion prune empty overflow sheets in the same undoable document update; a one-sheet project uses a single full-width grid column
- Regression added: reducer tests cover both deletion routes and preserve Sheet 1 as the permanent base sheet
- Notes/follow-up: CLIENT-20260720-09 remains ready for deployed retest

## 2026-07-21 - Rejected-Order Permanent Deletion

- Safety: the destructive action is shown only for rejected orders, requires explicit confirmation, and is visually separated from approve/reject/needs-changes controls
- Storage behavior: deletes every recorded R2 production object, then the Neon submission row and Render-local project directory; any R2 object error stops the database/local deletion and is reported to the admin
- Regression added: backend tests verify rejected deletion and HTTP 409 for other statuses; API and component tests verify the DELETE request, confirmation, and immediate admin-list removal
- Notes/follow-up: CLIENT-20260721-10 remains ready for deployed retest; permanent deletion cannot be undone

## 2026-07-21 - Admin Email-Status Cleanup

- Evidence: client confirmed email forwarding is working and requested removal of the large print-order email panel
- Correction: removed the email-delivery panel from admin review while retaining delivery status, recipient, timestamps, and errors in backend/order records
- Regression added: admin screen coverage supplies a successful email record and verifies the panel is absent
- Notes/follow-up: CLIENT-20260721-11 remains ready for deployed retest

## 2026-07-22 - Client Email Recipient And Admin Link

- Recipient configuration: documented `PRINT_ORDER_EMAIL_TO=orders@palmercodeworks.com,magicdecals@sunsignfactory.com` for Render production
- Email content: adds a direct admin-review URL, preferring `ADMIN_REVIEW_URL` and otherwise deriving the frontend origin from `CORS_ORIGIN`
- Regression added: SMTP delivery coverage verifies both recipients and the admin link in the outgoing message
- Automated: focused backend email tests, lint, and production build passed
- Notes/follow-up: CLIENT-20260722-12 needs a deployed live-order retest after the Render recipient variable is updated

## 2026-07-22 - Full-Height Desktop Sheet Workspace

- Evidence: client screenshot showed the fixed-height canvas ending above the browser's lower edge on a tall display
- Correction: the desktop center grid, sheet card, and canvas now flex through all remaining application height while retaining independent sheet scrolling and bottom padding
- Responsive behavior: mobile/tablet keeps the existing predictable 640px canvas height; desktop consumes the available viewport
- Regression added: a 1600 × 1000 Chromium check verifies the workspace reaches within 20px of the viewport bottom and can scroll to zero remaining distance
- Notes/follow-up: CLIENT-20260722-13 remains ready for deployed retest

## 2026-07-23 - Transient Canvas Settings Status

- Evidence: client screenshot showed the snap/spacing status chip permanently covering the upper-left artwork area
- Correction: the chip appears for 2.4 seconds on canvas load or snap/spacing setting changes, then unmounts without changing the active guides
- Accessibility: status updates retain polite announcement behavior while visible and honor reduced-motion preferences
- Regression added: Chromium verifies the initial settings confirmation is visible and then removed within four seconds
- Notes/follow-up: CLIENT-20260723-14 remains ready for deployed retest
