# Admin Interface Plan

## Goal

Build a private admin interface for maintaining pyramid club, ground, league-membership, and publish data without editing seed files or TypeScript constants by hand.

The admin source of truth is the pyramid model. Public-search tables are updated only through an explicit publish step for supported divisions.

## Decisions

- Protect admin pages and mutation APIs with a shared admin secret.
- Use `/admin/login` to set an HTTP-only admin cookie.
- Require CSRF protection for admin mutation routes.
- Record admin changes in an audit log with a static actor value.
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
- Edit club identity, club status, and primary ground assignment in the first admin version.
- Keep league/division structure editing out of scope for the first version; only manage memberships.
- Preserve venue assignment history with explicit admin-chosen effective dates.
- Allow shared venues, and warn before editing a venue currently used by multiple clubs.
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
- Make manual admin edits win over import/seed scripts by tracking admin-updated rows.

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

## Phase 2: Club And Ground Editor

Purpose: allow manual maintenance of club identity and primary ground data.

Scope:

- Club list and editor for name, aliases, status, source URL, verified date, and current primary venue.
- Venue editor for name, postcode, latitude, longitude, and approximate flag.
- Google Maps picker with place/postcode search and manual pin placement.
- Shared-venue warning showing affected clubs before venue edits.
- Assignment history updates through `club_venue_assignments` with admin-chosen effective dates.
- Travel-cache invalidation when coordinates move more than one straight-line mile.
- Admin audit entries and `admin_updated_at` protection for edited records.

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

## Open Implementation Details

- Cookie signing format and expiry duration.
- Exact CSRF token format.
- Whether admin route protection should use middleware, route-level helpers, or both.
- Exact D1 transaction implementation. D1 supports transactional batches in some contexts, but the adapter should expose a small app-level interface and hide the runtime differences.
- Whether foundational schema changes should be split into separate migration files per phase or grouped by phase.
