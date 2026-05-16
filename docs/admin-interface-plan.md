# Admin Interface Plan

## Goal

Build a private admin interface for maintaining pyramid club, ground, league-membership, and publish data without editing seed files or TypeScript constants by hand.

The admin source of truth is the pyramid model. Public-search tables are updated only through an explicit publish step for supported divisions.

## Decisions

- Protect admin pages and mutation APIs with a shared admin secret.
- Use `/admin/login` to set an HTTP-only admin cookie.
- Require CSRF protection for admin mutation routes.
- Record admin changes in an audit log with a static actor value.
- Rate limit failed admin login attempts before exposing data-editing tools.
- Defer login CSRF for the MVP while retaining CSRF protection on authenticated admin mutations.
- Keep seasons as first-class records.
- Create target seasons by copying memberships from a source season.
- Use a division-board league swapper with explicit move controls.
- Store movement types as `promotion`, `relegation`, or `migration`.
- Require promotion and relegation moves to follow configured `pyramid_edges`.
- Treat any non-promotion/non-relegation movement as a migration.
- Persist movement status so draft, confirmed, and applied/finalized work can resume later.
- Update the target-season roster as soon as a movement is confirmed.
- Support entries into and exits from the tracked pyramid as migration records with nullable source or target divisions.
- Require notes for migrations, entries, exits, unlocks, and overrides.
- Keep one current movement per club per target season; record revisions in the audit log.
- Lock division rosters independently when moves are confirmed and valid.
- Allow capacity overrides when a finalized division starts above or below its configured max size, with an override note stored on the season division.
- Edit club identity, club status, and primary ground assignment in the first admin version. Implemented in Phase 2B with inline editing on the club detail page.
- Keep league/division structure editing out of scope for the first version; only manage memberships.
- Add a public pyramid explorer and admin edge/layout editor before the season swapper so movement-path validation is maintained from DB data instead of TypeScript constants.
- Preserve venue assignment history with explicit admin-chosen effective dates. Default is next July 1st (overridable).
- Allow shared venues, and warn (require confirmation) before editing a venue currently used by multiple clubs.
- Use Google Maps JavaScript API in admin for place/postcode search and manual pin placement.
- Keep venue coordinates approximate until an admin manually places or drags the pin.
- Delete travel cache for a venue only when the straight-line movement from old coordinates to new coordinates is greater than one mile.
- Add an explicit mapping from pyramid clubs/divisions to public-search clubs/competitions.
- Publish only supported public clubs and venues at first; do not alter fixtures during publish.
- Avoid hard deletes in admin. Retire clubs instead of deleting them.
- Do not add venue status in the first version.
- Do not add venue source metadata in the first version.
- Add export/download support for memberships, movements, clubs, and venues.
- Keep correction review out of this feature slice.
- Make manual admin edits win over import/seed scripts by tracking admin-updated rows. Column (`admin_updated_at`) exists in schema; seed/import protection logic deferred.

## Phase 1: Admin Foundation

Purpose: establish the secure admin shell and database primitives needed by later admin features.

Detailed implementation planning lives in `docs/admin-phase-1-implementation.md`.

Scope:

- Add admin auth configuration and runtime accessors for the shared secret.
- Add `/admin/login`, logout, protected admin layout, and a minimal dashboard.
- Set an HTTP-only admin session cookie after successful login.
- Add CSRF token support for admin mutation APIs.
- Add middleware or route-level guards for `/admin` pages and `/api/admin/*` routes.
- Add `admin_audit_log` for admin mutation records.
- Add write-batch support to the database adapter so later precomputed multi-row writes can be atomic in SQLite and D1.
- Add only the minimum phase 1 schema migration: `admin_audit_log`.
- Add tests for auth checks, CSRF rejection, audit writes, and transaction rollback behavior.
- Document required environment variables.

Out of scope:

- Club editor UI.
- Ground map picker.
- League swapper UI.
- Publish/export flows.
- Correction review.

Phase 1 environment variables:

- `ADMIN_SECRET`: shared secret used at login.
- `ADMIN_SESSION_SECRET`: signing secret for admin cookies and CSRF tokens.

Phase 1 acceptance criteria:

- Unauthenticated users cannot access admin pages or admin APIs.
- Successful login sets a secure HTTP-only cookie and redirects to the admin dashboard.
- Logout clears the admin cookie.
- Admin mutation APIs reject missing or invalid CSRF tokens.
- Audit helper records entity type, entity id, action, before JSON, after JSON, actor, and timestamp.
- Write-batch helper commits all writes on success and rolls back all writes on failure.
- The foundation works locally with SQLite and in Cloudflare D1 runtime paths.

## Phase 2: Club And Ground Editor (Split Into Sub-phases)

Purpose: allow manual maintenance of club identity and primary ground data.

### Phase 2A: Read-Only Club Browser (Complete)

- Club list grouped by division for the latest season, with status badges and current primary ground column.
- Club detail page with club identity, current primary ground, venue assignment history, and warnings for missing/shared grounds.
- Latest-season scoping: both list and detail queries are filtered to the latest `pyramid_seasons` row.

### Phase 2B: Club Identity & Venue CRUD (Complete)

- **Club identity editor** — inline edit form on `/admin/clubs/[id]` (name, aliases, status, source URL, verified date). Toggled via `?edit=1`. All mutations audited and stamp `admin_updated_at`.
- **Venue CRUD** — standalone pages at `/admin/venues/` (list with club count), `/admin/venues/new` (create form), `/admin/venues/[id]` (detail + edit form with shared-venue warning).
- **Shared-venue confirmation** — if a venue has >1 current primary assignment, edits require checking a confirmation checkbox before proceeding. Enforced at the service layer.
- **Venue assignment** — assign-primary-ground form on club detail page. Default `effective_from` is the next July 1st; overridable. Old assignment closed with `effective_to = effective_from - 1 day`. Uses `writeBatch()`.
- **Create-then-assign flow** — venues created independently, then assigned to clubs. Supports neutral shared grounds (e.g. Twickenham, Wembley).
- **Write-path validation** — coordinate range checks, real-date parsing (`isValidDate()`), same-venue rejection, club/venue existence checks, `is_approximate` clearable from 1 to 0.
- **Database** — migration 007 adds `admin_updated_at TEXT` to `pyramid_clubs`, `venues`, and `club_venue_assignments`. Updated in `schema.ts`. Import protection deferred.

### Phase 2C: Google Maps Picker & Travel-Cache Invalidation (Not Started)

- Google Maps picker with place/postcode search and manual pin placement.
- Travel-cache invalidation when venue coordinates move more than one straight-line mile.
- Allow approximate coordinates until an admin manually places or drags the pin.

### Phase 2D: Pyramid Explorer & Edge/Layout Editor (In Progress)

Detailed implementation planning lives in `docs/pyramid-explorer-spec.md` and `docs/tickets/open/TICKET-035-pyramid-explorer-admin-editor.md`.

- Phase 1 complete: DB schema metadata and seed/D1 backfill merged in PR #79.
- Phase 2 complete: DB-backed explorer read model and tests merged in PR #81.
- Next: shared React/SVG graph rendering component, deterministic layout helper, and visual edge derivation.
- Add public `/pyramid` explorer backed by DB tables.
- Add protected `/admin/pyramid` editor using the same graph component.
- Store division layout order and movement-path metadata in the database.
- Maintain promotion/relegation edge topology with audited admin mutations.
- Use this as the graph/data foundation for Phase 3 season swapper validation.

## Phase 3: Season League Swapper

Purpose: manage promotion, relegation, and migration between season snapshots.

Scope:

- Create target season by copying a source season.
- Division-board UI with explicit move controls.
- Draft and confirmed movement persistence.
- Promotion/relegation edge validation.
- Migration notes and nullable movement ends for entering/leaving the tracked pyramid.
- Add-club-from-swapper flow for missing promoted/replacement clubs.
- Per-division locking with capacity override note support.
- Audited unlock for locked division/season corrections.

## Phase 4: Publish And Export

Purpose: safely publish canonical admin data to supported public-search rows and provide backup/export tools.

Scope:

- Export memberships, movements, clubs, and venues as CSV or JSON.
- Explicit pyramid-club to public-club mapping.
- Explicit pyramid-division to public-competition mapping.
- Publish supported public club identity and venue fields.
- Skip unmapped divisions.
- Do not alter fixtures during publish.
- Ensure import/seed scripts skip admin-edited fields unless forced.

## Resolved Implementation Details

- Cookie signing format: HMAC-SHA256 via `createHmac`, base64url-encoded. 8-hour expiry.
- CSRF token format: same HMAC-SHA256 signed token, separate purpose field. 8-hour expiry.
- Route protection: per-route helpers (`requireAdminPageSession` for pages, `getAdminSessionFromRequest` for API routes). No middleware.
- D1 transactions: `D1Database.batch()` via `writeBatch()`.
- Schema migrations: one numbered SQL file per migration, sorted and applied via `applyPendingMigrations`.
