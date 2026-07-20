# Release-Candidate Gate

Use this gate after a client feedback batch has been triaged and fixed. A passing automated test run alone does not close an unverified client issue.

## Promotion Requirements

- The live submission proof is current and passed.
- Client feedback is recorded in `docs/client-feedback-log.md`.
- No blocker or high issue remains open, reproducing, fixing, or ready for retest.
- Every confirmed bug has a focused regression test, or a documented reason why a manual regression is required.
- Every fixed client issue has been retested through its original steps.
- `docs/qa-notes.md` records the feedback batch, fixes, regression coverage, and remaining risks.
- `npm run test:client-ready` passes on the intended release commit.
- The deployment checklist and post-deploy smoke test are complete.
- Rollback ownership and the last known-good commit are recorded.

## Gate Decision

- **Hold:** any blocker is open, submission/print files are unreliable, or required production services cannot be verified.
- **Retest:** fixes are deployed but one or more client issues still need verification.
- **Candidate:** no blocker/high issue is open, fixes are verified, and the full client-ready gate passes.

Medium and low issues may remain only when they are explicitly accepted, have an owner, and do not undermine print correctness or customer trust.

## Current Gate Record

- Date: 2026-07-17
- Automated gate: passed (`npm run test:client-ready`; 157 automated tests and 13 browser tests)
- Live submission proof: passed
- Reported client defects: CLIENT-20260720-01 through CLIENT-20260720-05 are ready for deployed retest
- Performance observation: cold-start submission latency remains under monitoring
- Decision: hold until the durable admin-list, SVG classification, effective-DPI, keyboard-deletion, and resize retests pass

## Release Record Template

```md
## Release candidate YYYY-MM-DD

- Commit:
- Client session:
- Blocker/high queue:
- Accepted medium/low issues:
- Regression tests added:
- `npm run test:client-ready`:
- Post-deploy smoke:
- Last known-good commit:
- Rollback owner:
- Decision: hold | retest | candidate
```
