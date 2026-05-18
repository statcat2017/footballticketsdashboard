# Sprint 1: Admin D1 Stabilisation & Data Quality

**Dates:** Ongoing — closed manually at Sprint 2 kickoff
**Status:** Done

## Goal

Stabilise admin publish and venue workflows on Cloudflare D1, apply migrations automatically on deploy, and make `/admin/publish` and `/admin/data-quality` performant and usable.

## Completed Work

### Infrastructure

- **D1 transaction removal** — replaced all production admin route `db.transaction()` calls with D1-compatible `db.writeBatch()` across:
  - Club publish (`app/api/admin/publish/club/route.ts`)
  - Competition publish (`app/api/admin/publish/competition/route.ts`)
  - Bulk club publish (`app/api/admin/publish/clubs/route.ts`)
  - Venue update (`lib/admin/venues.ts`)
- **Audit SQL consolidation** — added `buildAdminAuditLogWrite()` helper in `lib/admin/audit.ts` so batch-based flows share audit serialisation instead of duplicating raw SQL. Refactored `writeAdminAuditLog()` to delegate to it.
- **Deploy pipeline** — `npm run deploy` now auto-applies remote D1 migrations before building and deploying the Worker.

### Admin Publish

- Division-scoped club list on `/admin/publish?division_id=...` to avoid Worker CPU limits.
- Bulk "Publish all ready clubs" button for a selected division.
- Competition tier expanded from `1-4` to `1-10` (migration 015, with FK-safe child table rebuild).
- Fixed visual bug: literal `"&larr;"` changed to Unicode `←`.

### Venue Admin

- Venue location update now uses `db.writeBatch()` with `buildUpdateStatements()`.
- Coordinate confirmation flow with travel-cache invalidation on >1 mile move.
- Route-level coordinate validation.

### Data Quality Dashboard

- Live data-quality checks at `/admin/data-quality`.
- 14 check types across errors, warnings, and info.
- Dashboard grouped by `severity + issueType` as collapsible `<details>` sections.
- Error groups open by default; warning and info collapsed.
- `issueType` field added to every `DataQualityIssue` for consistent grouping.
- `ground_approximate` no longer flagged as imprecise — treated as a valid exact ground coordinate.
- Venue admin UI relabelled `ground_approximate` to "Ground located" with green/exact styling.
- Map editor no longer auto-checks `is_approximate` when placing a marker.

## Milestone Tickets Completed

| Ticket | Description | Status |
|--------|-------------|--------|
| TICKET-036 | Fixture source registry and import batch schema | Schema complete |
| TICKET-037 | Public club/competition mapping and publish layer | Complete |
| TICKET-038 | Fixture season, time, provenance, confidence schema | Schema complete |
| TICKET-039 | Structured scoped club alias management | Complete |
| TICKET-040 | Venue geocoding, coordinate precision, travel invalidation | Complete |
| TICKET-041 | Admin data quality dashboard v1 | Complete |

## Open Post-Sprint Follow-Ups

- Map editor help text still says "Moving the pin will mark this venue's coordinates as approximate" — should be updated to reflect new `ground_approximate` semantics.

## Validation

- `npm run lint` — clean
- `npm run test` — 222 tests passing (21 files)
- `npm run build` — clean
- Deployed to `https://fixtures.statcat.co.uk`
