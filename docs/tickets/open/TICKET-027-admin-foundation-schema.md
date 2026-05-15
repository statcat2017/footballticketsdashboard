# TICKET-027: Admin Foundation Schema

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-025, TICKET-026

## Purpose

Add only the minimum phase 1 schema needed for admin audit logging.

## Work

- Add `admin_audit_log` to the schema and migration path.
- Defer `admin_updated_at`, club retirement, season status, movement changes, capacity overrides, and publish mappings to later phase-specific PRs.
- Update schema docs and migration tests.

## Acceptance Criteria

- Existing seed/setup paths still run successfully.
- Existing pyramid data remains unchanged after migration.
- Schema documentation lists `admin_audit_log` and its purpose.

## Verification

- `npm run db:setup`
- Schema/setup tests.
- `npm run lint`
- `npm run test`
