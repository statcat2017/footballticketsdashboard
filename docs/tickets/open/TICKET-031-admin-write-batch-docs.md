# TICKET-031: Admin Write Batch Semantics Documentation

Status: open
Owner: Backend
Priority: low
Depends on: TICKET-026
GitHub: https://github.com/statcat2017/footballticketsdashboard/issues/68

## Purpose

Prevent future admin features from treating `writeBatch` as a callback transaction or relying on unsupported read-after-write branching.

## Work

- Add developer-facing documentation for `AppDatabase.writeBatch`.
- Explain that writes must be precomputed before calling `writeBatch`.
- Explain SQLite behavior and D1 `batch()` behavior.
- Explain that operations needing read-after-write branching should be redesigned or implemented with an explicit D1-safe flow.

## Acceptance Criteria

- Future admin implementation docs link to the write-batch guidance.
- The adapter contract is clear enough to avoid accidental callback-transaction assumptions.

## Verification

- Documentation review.
