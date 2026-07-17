# Client Feedback Log

Use this file as the single production-readiness queue after each client test session. Record observed behavior, not assumptions, and keep the most urgent open item at the top of its severity section.

## Current Release-Candidate Status

- Review date: 2026-07-17
- Client test status: initial live submission proof passed
- Open blockers: none reported
- Open high issues: none reported
- Open medium issues: none reported
- Open low issues: none reported
- Release status: candidate awaiting the next client feedback cycle

## Monitored Observations

### First submission latency on free-tier hosting

- Status: monitor; not a confirmed defect
- Area: proof submission
- Observed: the live proof submission took approximately 30 seconds or more.
- Likely context: a free-tier Render cold start.
- Next check: compare a cold submission with a second warm submission and record both timings.
- Escalate to an issue when: warm submissions remain unusually slow, the UI times out, or the customer cannot tell that submission is still in progress.

## Blockers

No open items.

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
