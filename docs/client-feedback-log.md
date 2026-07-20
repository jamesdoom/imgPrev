# Client Feedback Log

Use this file as the single production-readiness queue after each client test session. Record observed behavior, not assumptions, and keep the most urgent open item at the top of its severity section.

## Current Release-Candidate Status

- Review date: 2026-07-17
- Client test status: initial live submission proof passed
- Open blockers: 2 awaiting deployed retest
- Open high issues: none reported
- Open medium issues: none reported
- Open low issues: none reported
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

No open items.

## Low

No open items.

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
