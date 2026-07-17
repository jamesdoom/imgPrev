# Live Submission Proof

## 2026-07-17 Operator Verification

Status: passed, reported by the production operator.

The deployed customer and admin flow was exercised with a live submission. The operator reported no functional issues and confirmed the proof path completed successfully.

Verified outcomes:

- Customer submission completed and a receipt appeared.
- Admin received the submitted project.
- The Print PDF opened successfully.
- Cloudflare R2 stored the production files.
- Neon recorded the order.
- Email delivery sent the PDF and order details.

Observed limitation:

- The order submission took approximately 30 seconds or more.
- The operator attributed this to free-tier server spin-up. Treat this as a hosting cold-start observation unless it also reproduces on a warm Render instance.

Follow-up:

- Record warm and cold submission durations during future deployment smoke tests.
- Reclassify as a performance defect if warm submissions repeatedly exceed the agreed client threshold.
