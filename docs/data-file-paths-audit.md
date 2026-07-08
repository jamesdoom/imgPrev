# Data And File Path Audit

This audit supports step 3: improve reliability around data and files without adding new product features.

## Scope

Reviewed paths:

- Upload parsing for the legacy image uploader and sticker sheet designer.
- DPI detection and image metadata fallback.
- Thumbnail creation and persisted preview behavior.
- Autosave restore and project JSON import/export.
- Proof rendering and print submission.
- Admin project listing, detail loading, file previews, downloads, and review updates.

## Customer Upload Paths

### Legacy Image Uploader

Entry points:

- `src/components/ImageUploader/ui/Dropzone.tsx`
- `src/components/ImageUploader/hooks/useImageUpload.ts`
- `backend/app.ts` `/upload`

Current behavior:

- Browser rejects empty drops, non-image files, and files over 21 MB before upload.
- Backend repeats MIME and size checks before processing with Sharp.
- Successful uploads return a processed WebP URL under `/processed`.
- DPI detection is best-effort and omitted when unavailable.

Existing coverage:

- `src/components/ImageUploader/hooks/useImageUpload.test.ts`
- `src/components/ImageUploader/utils/getDpi.test.ts`
- `backend/app.test.ts`
- `tests/e2e/customer-editor.spec.ts`

Reliability gaps to test next:

- Backend returns malformed JSON or a success response without `previewUrl`.
- `Image.decode()` fails after a successful backend response.
- `getDpi()` throws instead of returning `null`.
- Dropzone accepts a file with a misleading MIME type but unsupported extension.

### Sticker Sheet Designer Upload

Entry point:

- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx`

Current behavior:

- `handleFiles()` validates each file with shared upload rules.
- Accepted artwork is converted into a `SheetAsset` plus an initial placed decal.
- Image assets use data URLs for durable source storage.
- PDF and other non-raster accepted files use object URLs for source display and generated SVG thumbnails for preview.
- DPI and image dimensions are best-effort; failed image metadata reads resolve to empty metadata instead of blocking upload.

Existing coverage:

- `src/domain/print/uploadRules.test.ts`
- `src/domain/print/placement.test.ts`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx`
- `tests/e2e/customer-editor.spec.ts`

Reliability gaps to test next:

- Unsupported file type shows the upload-rule error and does not mutate the document.
- Oversized upload shows the size error and does not mutate the document.
- Mixed upload batch accepts valid files while reporting invalid files.
- Image dimension load fails and the asset remains usable with a clear fallback.
- SVG/PDF fallback thumbnails remain stable after reload or import.

## DPI And Metadata

Entry points:

- `src/components/ImageUploader/utils/getDpi.ts`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `readImageDpi()`
- `src/domain/print/preflight.ts`
- `src/domain/print/placement.ts`

Current behavior:

- `getDpi()` reads JPEG JFIF, PNG pHYs, and TIFF XResolution metadata.
- Sticker sheet uploads catch DPI parsing errors and store no `dpi` when unavailable.
- Artwork readiness displays detected DPI when present and "DPI metadata unavailable" when image dimensions exist but DPI does not.
- Preflight skips DPI warnings when DPI is missing.
- Placement uses detected DPI when available and falls back to the profile required DPI.

Existing coverage:

- `src/components/ImageUploader/utils/getDpi.test.ts`
- `src/domain/print/preflight.test.ts`
- `src/domain/print/placement.test.ts`

Reliability gaps to test next:

- Corrupt/truncated JPEG, PNG, and TIFF files return `null` instead of throwing.
- PNG pHYs data with unsupported units returns `null`.
- TIFF IFD offsets outside the file bounds do not throw.
- Sticker sheet upload still succeeds if `getDpi()` throws.
- UI copy for missing DPI remains specific and non-alarming.

## Thumbnail And Preview Persistence

Entry points:

- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `createImageThumbnailDataUrl()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `createFileThumbnailDataUrl()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `AssetThumbnail`
- `src/components/StickerSheetDesigner/StickerSheetCanvas.tsx`

Current behavior:

- Raster image thumbnails are downscaled to a persisted data URL with a 320 px max dimension.
- Thumbnail generation falls back to the source URL if image load, canvas context, or draw/export is unavailable.
- File thumbnails are generated as escaped inline SVG data URLs.
- Autosave retries with preview-only source URLs when localStorage rejects the full document.
- Blob-only assets are dropped when loading saved/imported project JSON because they are not durable across browser sessions.

Existing coverage:

- `tests/e2e/customer-editor.spec.ts` verifies upload and reload for a persisted SVG preview path.
- `src/components/StickerSheetDesigner/StickerSheetDesigner.accessibility.test.tsx` covers restored saved artwork in the editor shell.

Reliability gaps to test next:

- Canvas thumbnail generation fails and falls back without breaking upload.
- localStorage quota failure triggers preview-only saved document behavior.
- Saved project with blob-only assets restores without stale items.
- Saved project with missing preview but durable source restores.
- File names with SVG-special characters are escaped in generated thumbnails.

## Autosave, Restore, Import, And Export

Entry points:

- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `saveDocumentLocally()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `loadSavedDocument()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `readDocumentFromProjectJson()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `downloadProjectJson()`
- `src/domain/print/exportBundle.ts`

Current behavior:

- Autosave is best-effort and silently fails after a preview-only retry.
- Restore accepts either raw `SheetDocument` JSON or an export bundle with a `document` field.
- Restore normalizes the sheet to the active MVP profile and required DPI.
- Restore filters out assets and items that do not have durable asset URLs.
- Import resets transient file handles, quantities, submitted project state, and selection.
- Export writes the manifest bundle, not only the raw sheet document.

Existing coverage:

- `src/domain/print/exportBundle.test.ts`
- `src/domain/print/sheetDocument.test.ts`
- `src/domain/print/sheetDocumentReducer.test.ts`
- `tests/e2e/customer-editor.spec.ts`

Reliability gaps to test next:

- Malformed saved JSON is ignored and starts a fresh document.
- Stale saved project with invalid shape is ignored and starts a fresh document.
- Importing invalid JSON shows a useful error and preserves the current document.
- Importing a project with only stale blob assets removes stale assets and items.
- Exported bundle can be imported back into the designer.

## Proof Rendering And Submission

Entry points:

- `src/components/StickerSheetDesigner/renderProductionFiles.ts`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `downloadAvailableBundleFiles()`
- `src/components/StickerSheetDesigner/StickerSheetDesigner.tsx` `submitForReview()`
- `backend/app.ts` `/render-sheet` and `/submit-project`
- `backend/renderSheet.ts`

Current behavior:

- Client builds a multipart form with a manifest and available asset files.
- Data URL sources are converted back into `File` objects when transient upload handles are unavailable.
- Render and submit failures surface backend error messages when available.
- Backend validates manifest presence, JSON shape, asset MIME types, missing uploaded asset files, and file size limits.
- Submitted projects write `project.json`, `manifest.json`, `review.json`, `preview.png`, `print.pdf`, and original assets.
- When Postgres and Cloudflare R2 are configured, the backend stores the print PDF, preview PNG, order record, and project JSON under `R2_PREFIX/proofs/<projectId>/` while also writing a `print_submissions` row for admin tracking. Local project files remain the immediate handoff source.

Existing coverage:

- `src/components/StickerSheetDesigner/renderProductionFiles.test.ts`
- `backend/app.test.ts`
- `tests/e2e/customer-editor.spec.ts`

Reliability gaps to test next:

- Client handles non-JSON backend error responses.
- Client handles network rejection during render and submit.
- Client detects successful submit responses missing `projectId`.
- Data URL conversion rejects non-base64 or malformed data URLs without crashing.
- Backend rejects unsupported production PDFs with a stable error.

## Admin File Preview And Review Paths

Entry points:

- `src/admin/adminReviewApi.ts`
- `src/admin/AdminReviewScreen.tsx`
- `backend/app.ts` `/admin/projects`, `/admin/projects/:projectId`, `/admin/projects/:projectId/review`, and static `/projects`

Current behavior:

- Admin API helpers parse JSON responses and use fallback messages for failed requests.
- Relative project file paths are resolved against `API_BASE_URL`; absolute HTTP(S) URLs pass through unchanged.
- Admin detail view shows preview image, metadata, export file links, original artwork links, review decision controls, and review history.
- Backend filters unsafe project ids and hides unreadable/corrupt submitted project folders from lists.
- Review updates validate status, note length, reviewer fallback, and append history.

Existing coverage:

- `src/admin/adminReviewApi.test.ts`
- `src/admin/AdminReviewScreen.test.tsx`
- `backend/app.test.ts`
- `tests/e2e/admin-review.spec.ts`

Reliability gaps to test next:

- Admin list skips corrupt project directories while returning valid projects.
- Missing preview, print PDF, manifest, or asset files show "Missing" states consistently.
- Admin detail handles 404 after selecting a project.
- Static file URLs with unusual but safe filenames remain encoded and downloadable.
- Review update failure preserves entered note and reviewer for retry.

## Highest-Value Next Tests

1. Sticker sheet upload rejects unsupported and oversized files without changing document state.
2. Saved project restore ignores malformed/stale JSON and filters blob-only assets/items.
3. Thumbnail generation falls back when image/canvas operations fail.
4. `getDpi()` handles corrupt JPEG/PNG/TIFF metadata without throwing.
5. Proof submission handles failed network, non-JSON error, and malformed success payloads.
6. Admin review shows clear missing-file states and preserves review form input after update failure.

## Audit Result

The data/file paths are generally well-separated and already use several defensive fallbacks. The fragile areas are not broad architecture problems; they are mostly unproven edge cases around corrupt metadata, stale persisted data, browser storage limits, and malformed backend responses. Step 3 should focus on targeted regression tests first, then small fallback-copy or guard improvements where those tests expose ambiguity.
