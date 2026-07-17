# Production Reliability Checks

Use this matrix when changing uploads, rendering, persistence, email, autosave, or admin review behavior.

| Failure mode | Expected behavior | Regression coverage |
| --- | --- | --- |
| Customer artwork exceeds 25 MB | Reject before rendering with the actual 25 MB limit; keep the editor usable | `backend/app.test.ts`, `src/domain/print/uploadRules.test.ts`, `tests/e2e/customer-editor.spec.ts` |
| Artwork has no embedded DPI | Use the production profile DPI for initial sizing and explain that metadata was unavailable | `src/components/ImageUploader/hooks/useImageUpload.test.ts`, `tests/e2e/customer-editor.spec.ts` |
| Render or PDF generation fails | Return an actionable error, do not show a receipt, and preserve the customer layout for retry | `backend/app.test.ts`, `src/components/StickerSheetDesigner/renderProductionFiles.test.ts`, `tests/e2e/customer-editor.spec.ts` |
| R2 upload or Neon persistence fails | Keep the locally saved print package and record production storage as failed in both project and order records | `backend/app.test.ts` |
| SMTP delivery fails | Keep the locally saved print package and record email delivery as failed with the provider error | `backend/app.test.ts` |
| Saved project JSON is stale or corrupt | Start a clean sheet with a notice; drop expired blob-only artwork without breaking durable items | `tests/e2e/customer-editor.spec.ts` |
| Admin list API cannot read storage | Return HTTP 500 with a stable error payload; admin UI offers refresh/retry | `backend/app.test.ts`, `src/admin/adminReviewApi.test.ts`, `src/admin/AdminReviewScreen.test.tsx` |
| Admin detail or review API fails | Keep the selected workflow recoverable and retain entered reviewer notes after a failed decision | `src/admin/adminReviewApi.test.ts`, `src/admin/AdminReviewScreen.test.tsx` |

## Reliability Invariants

- Never show a successful customer receipt until the local print PDF, preview, order record, project record, and artwork files are saved.
- R2/Neon and SMTP remain background operations; their failure must not delete or overwrite the local print package.
- Persist background failure states so admin can distinguish failed, queued, skipped, and successful operations.
- Reject oversized files with the limit that applies to the route.
- Return controlled JSON errors from admin APIs instead of allowing rejected async work to leave requests hanging.

## Phase 5 Result

The focused regression suite passed after correcting two issues found during stress review:

1. Oversized render and submission files reported the legacy 21 MB image-upload limit even though those routes allow 25 MB.
2. A filesystem error while listing admin projects escaped the async route instead of returning a controlled HTTP 500 response.

The full client-ready gate should be rerun after any change to this matrix.
