# TICKET-026: Database Write Batch Support

Status: open
Owner: Backend
Priority: high
Depends on:

## Purpose

Give admin batch operations an all-or-nothing write primitive before implementing league swaps, publishing, or multi-row ground changes.

## Work

- Extend the app database abstraction with a write-only atomic batch operation suitable for SQLite and D1.
- Ensure SQLite rolls back all writes when one batch statement fails.
- Ensure D1 uses `D1Database.batch()` rather than a callback-style transaction abstraction.
- Keep the abstraction small and focused on app needs.
- Add tests for commit and rollback behavior.

## Acceptance Criteria

- Callers can group precomputed writes and receive per-statement write metadata.
- Failed grouped writes do not partially persist in SQLite.
- D1 behavior is covered by adapter tests that verify `binding.batch()` is used.
- Existing database callers continue to work unchanged.

## Verification

- Adapter tests for successful batch, rollback, and D1 batch usage.
- Existing database setup tests still pass.
- `npm run lint`
- `npm run test`
