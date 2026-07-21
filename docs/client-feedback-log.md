# Client Feedback Log

Use this file as the single production-readiness queue after each client test session. Record observed behavior, not assumptions, and keep the most urgent open item at the top of its severity section.

## Current Release-Candidate Status

- Review date: 2026-07-17
- Client test status: initial live submission proof passed
- Open blockers: 5 awaiting deployed retest
- Open high issues: none reported
- Open medium issues: 4 awaiting deployed retest
- Open low issues: 2 awaiting deployed retest
- Release status: hold until CLIENT-20260720-01 is verified

## Monitored Observations

### First submission latency on free-tier hosting

- Status: monitor; not a confirmed defect
- Area: proof submission
- Observed: the live proof submission took approximately 30 seconds or more.
- Likely context: a free-tier Render cold start.
- Next check: compare a cold submission with a second warm submission and record both timings.
- Escalate to an issue when: warm submissions remain unusually slow, the UI times out, or the customer cannot tell that submission is still in progress.

## Blockers

### Resize handles intermittently reverse or exaggerate drag distance

- ID: CLIENT-20260720-05
- Status: ready for retest
- Area: customer editor | canvas
- Browser/device: production browser session
- Artwork used: client test artwork
- Steps to reproduce: resize a selected decal, then make a small inward or outward handle drag
- Expected: inward drags consistently shrink and outward drags consistently enlarge in proportion to pointer movement
- Actual: small inward drags could enlarge the decal, and some drags over-shrank or over-enlarged it
- Evidence: client report on 2026-07-20
- Severity: blocker
- Owner: application
- Regression test: `canvasTransform.test.ts` verifies committed scale is normalized and a successive inward drag reduces both dimensions
- Fix commit: Phase 7 canvas resize normalization
- Retest result: pending deployment
- QA notes: the canvas node now absorbs transform scale into width/height and resets scale immediately so it cannot be applied twice

### Delete-key removal leaves stale artwork in the left list

- ID: CLIENT-20260720-04
- Status: ready for retest
- Area: customer editor | keyboard
- Browser/device: production browser session
- Artwork used: client test artwork
- Steps to reproduce: select the only placed decal for an artwork file and press Delete
- Expected: the decal and its now-unused artwork row are removed
- Actual: the decal disappeared from the sheet but the artwork remained in the left list
- Evidence: client report on 2026-07-20
- Severity: blocker
- Owner: application
- Regression test: `tests/e2e/customer-editor.spec.ts` verifies Delete removes the artwork row when its last placed decal is selected
- Fix commit: Phase 7 keyboard deletion correction
- Retest result: pending deployment
- QA notes: Delete selected now removes an orphaned artwork source, while preserving the source if another placed copy still uses it

### Raster DPI warning ignores the decal's placed print size

- ID: CLIENT-20260720-03
- Status: ready for retest
- Area: customer editor | preflight
- Browser/device: production browser session
- Artwork used: `arizona_diamondbacks.png` (905 × 720 px, embedded 72 DPI)
- Steps to reproduce: upload the PNG, place it below approximately 6 inches wide, and review preflight
- Expected: effective DPI is calculated from pixels divided by placed inches
- Actual: the embedded 72 DPI value triggered a below-150-DPI error even at a print size above 150 effective DPI
- Evidence: client report and source artwork inspected on 2026-07-20
- Severity: blocker
- Owner: application
- Regression test: `src/domain/print/preflight.test.ts` verifies this 905 × 720 image at 5 inches is approximately 181 effective DPI and at 6.1 inches is approximately 148 effective DPI
- Fix commit: Phase 7 effective-DPI correction
- Retest result: pending deployment
- QA notes: raster resolution now updates from each decal's actual placed width, height, and scale instead of trusting embedded DPI metadata

### SVG artwork incorrectly receives a below-150-DPI error

- ID: CLIENT-20260720-02
- Status: ready for retest
- Area: customer editor | preflight
- Browser/device: production browser session
- Artwork used: client SVG artwork
- Steps to reproduce: upload the SVG and review its artwork/preflight status
- Expected: SVG artwork is identified as vector and is not evaluated using raster DPI thresholds
- Actual: the SVG displayed a below-150-DPI message
- Evidence: client report on 2026-07-20
- Severity: blocker
- Owner: application
- Regression test: `src/domain/print/preflight.test.ts` does not apply raster DPI limits to SVG artwork, including extension-based SVG detection with a stale DPI value
- Fix commit: Phase 7 SVG preflight correction
- Retest result: pending deployment
- QA notes: preflight and artwork readiness now identify SVG before evaluating DPI

### Submitted order disappears from admin after Render local storage resets

- ID: CLIENT-20260720-01
- Status: ready for retest
- Area: admin review | storage
- Browser/device: production browser session
- Artwork used: realistic client test order
- Steps to reproduce: submit an order, wait approximately 10 minutes, reopen or refresh the admin panel
- Expected: the submitted order remains listed and reviewable
- Actual: admin returned “No submitted projects found.”
- Evidence: client report on 2026-07-20
- Severity: blocker
- Owner: application
- Regression test: `backend/app.test.ts` keeps Neon-backed projects reviewable after local Render files disappear
- Fix commit: Phase 7 durable admin recovery change
- Retest result: pending deployment
- QA notes: admin list/detail/review now use Neon when Render-local files are absent; stored PDF and preview are served from R2

## High

No open items.

## Medium

### Rejected orders cannot be permanently removed

- ID: CLIENT-20260721-10
- Status: ready for retest
- Area: admin review | storage
- Browser/device: production admin panel
- Artwork used: any rejected order
- Steps to reproduce: reject an order and attempt to remove its obsolete production records
- Expected: a guarded action permanently deletes a rejected order and all associated stored files
- Actual: rejected orders remained in the admin list indefinitely
- Evidence: client report on 2026-07-21
- Severity: medium
- Owner: application
- Regression test: backend, admin API, and admin screen tests cover the rejected-only rule, confirmation, deletion, and list update
- Fix commit: Phase 7 rejected-order cleanup
- Retest result: pending deployment
- QA notes: deletion removes local files, the Neon record, and every recorded R2 object; non-rejected orders receive HTTP 409

### Empty overflow sheet persists and leaves Sheet 1 half width

- ID: CLIENT-20260720-09
- Status: ready for retest
- Area: customer editor
- Browser/device: production browser session
- Artwork used: a two-sheet project
- Steps to reproduce: delete every decal from Sheet 2 without running Auto-arrange
- Expected: the empty overflow sheet disappears immediately and Sheet 1 expands into the available editor width
- Actual: Sheet 2 remained until Auto-arrange, after which the desktop grid still reserved its empty column
- Evidence: client report and screenshot on 2026-07-20
- Severity: medium
- Owner: application
- Regression test: reducer coverage verifies both decal-only and last-artwork deletion prune an empty overflow sheet
- Fix commit: Phase 7 empty-sheet cleanup
- Retest result: pending deployment
- QA notes: Sheet 1 remains the permanent base sheet; empty overflow sheets are removed and remaining sheet labels are compacted

### Add more artwork targets Sheet 1 after overflow creates Sheet 2

- ID: CLIENT-20260720-08
- Status: ready for retest
- Area: customer editor
- Browser/device: production browser session
- Artwork used: a multi-sheet project
- Steps to reproduce: create Sheet 2 through confirmed Auto-arrange overflow, then select Add more artwork
- Expected: newly uploaded artwork is placed on the newest sheet
- Actual: the artwork was placed on Sheet 1
- Evidence: client report on 2026-07-20
- Severity: medium
- Owner: application
- Regression test: the multi-sheet customer browser workflow verifies Add more artwork increments Sheet 2 after overflow
- Fix commit: Phase 7 newest-sheet upload destination
- Retest result: pending deployment
- QA notes: Auto-arrange now activates the last sheet it creates; deliberate sheet selection continues to control later placement

### Auto-arrange should offer another paid sheet for overflow

- ID: CLIENT-20260720-07
- Status: ready for retest
- Area: customer editor | proof submit | admin review
- Browser/device: production browser session
- Artwork used: a quantity large enough to exceed one sheet
- Steps to reproduce: place more decals than Sheet 1 can hold and select Auto-arrange
- Expected: the app reports the exact overflow before increasing cost, adds each confirmed sheet, shows per-sheet preflight and total price, and produces reviewable production output for every sheet
- Actual: Auto-arrange previously left excess decals unplaced on a single sheet
- Evidence: client feature request on 2026-07-20
- Severity: medium
- Owner: application
- Regression test: placement, render, submission, admin, and customer browser tests cover confirmed multi-sheet overflow and a multi-page PDF
- Fix commit: Phase 7 multi-sheet overflow
- Retest result: pending deployment
- QA notes: old projects without an explicit sheet list continue to open as one-sheet projects

## Low

### Email-delivery panel adds noise after forwarding is proven

- ID: CLIENT-20260721-11
- Status: ready for retest
- Area: admin review | email
- Browser/device: production admin panel
- Artwork used: any submitted order
- Steps to reproduce: open an order after email forwarding is configured and working
- Expected: production review stays focused on print files, storage, and review decisions
- Actual: a large print-order email status panel repeated operational information on every order
- Evidence: client report and screenshot on 2026-07-21
- Severity: low
- Owner: application
- Regression test: admin screen coverage verifies email delivery data does not render the removed panel
- Fix commit: Phase 7 admin email-status cleanup
- Retest result: pending deployment
- QA notes: email status remains in backend and order records for diagnostics; only the admin presentation was removed

### Auto-arrange action needs stronger visual emphasis

- ID: CLIENT-20260720-06
- Status: ready for retest
- Area: customer editor
- Browser/device: production browser session
- Artwork used: any multi-decal project
- Steps to reproduce: prepare multiple decals and locate Auto-arrange in the artwork panel
- Expected: the frequently used Auto-arrange action is easy to find without competing with submission
- Actual: the neutral button blended into secondary controls
- Evidence: client feedback on 2026-07-20
- Severity: low
- Owner: application
- Regression test: customer browser workflow verifies the enabled action uses its distinct blue treatment before arranging
- Fix commit: Phase 7 Auto-arrange emphasis
- Retest result: pending deployment
- QA notes: disabled Auto-arrange remains neutral and explanatory; enabled Auto-arrange is blue with white text

## Issue Entry Template

Copy one entry into the appropriate severity section:

```md
### Short issue title

- ID: CLIENT-YYYYMMDD-01
- Status: open | reproducing | fixing | ready for retest | verified | closed
- Area: customer editor | admin review | upload | proof submit | receipt | email | storage | deployment | accessibility
- Browser/device:
- Artwork used:
- Steps to reproduce:
- Expected:
- Actual:
- Evidence:
- Severity: blocker | high | medium | low
- Owner:
- Regression test:
- Fix commit:
- Retest result:
- QA notes:
```

## Triage And Fix Order

1. Confirm the report is reproducible and preserve its evidence.
2. Classify it using the severity guide in `docs/client-test-script.md`.
3. Stop release-candidate promotion for any blocker.
4. Fix blockers first, then high, medium, and low issues.
5. Add the smallest focused regression test for every confirmed bug.
6. Record the fix and test in `docs/qa-notes.md`.
7. Move the item to `ready for retest`; do not mark it verified until the original workflow passes.
8. Re-run `npm run test:client-ready` after the feedback batch is resolved.

## Session Summary Template

```md
## YYYY-MM-DD - Client Test Session

- Tester(s):
- App/admin environment:
- Artwork set:
- Customer flow result:
- Admin flow result:
- Issues added:
- Issues verified:
- Cold submit time:
- Warm submit time:
- Gate result:
- Release recommendation: hold | retest | candidate
```
