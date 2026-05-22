# TICKET-025: Admin Audit Log

Status: done
Owner: Backend
Priority: high
Depends on: TICKET-024

## Purpose

Record admin mutations so manual data changes can be reviewed, debugged, and traced without relying on memory or database backups alone.

## Work

- Add an `admin_audit_log` table.
- Store action, entity type, entity id, before JSON, after JSON, actor, and timestamp.
- Use a static actor value for the shared-secret MVP.
- Add an audit helper that can be reused by later admin features.
- Add a read-only audit list endpoint or admin dashboard section if minimal and useful for verification.

## Acceptance Criteria

- Admin code can write an audit entry through a reusable helper.
- Audit rows include enough data to understand what changed and when.
- Invalid audit payloads fail clearly before writing malformed records.
- Audit storage works with local SQLite and D1.

## Verification

- Tests for audit helper inserts.
- Schema setup test covers the new table.
- `npm run lint`
- `npm run test`
