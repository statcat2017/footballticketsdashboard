# SQLite Schema

Run `npm run db:setup` to create or update `data/nearmefc.sqlite`, apply the schema from `lib/db/schema.ts`, and seed demo data. The setup is idempotent, so it can be rerun safely.

To reset local data, delete `data/nearmefc.sqlite` and run `npm run db:setup` again. The SQLite file and WAL/SHM sidecars are ignored by git.

## Current Tables (22 total, migrations 001–027)

### Core Data

- **`competitions`** — League/cup definitions with tier (1–10) and kind (league/cup/friendly).
- **`venues`** — Ground locations with postcode, coordinates, precision metadata, and verification timestamps.
- **`clubs`** — Club records with football-data.org ID, aliases, venue reference, ticket/ground source URLs, and coordinate metadata.
- **`fixtures`** — Match records with source tracking, one-off participant support, date/time split, confidence enum, and provenance fields.
- **`club_ticket_prices`** — Default adult/concession prices per club with confidence and source URL.
- **`fixture_ticket_price_overrides`** — Fixture-specific price exceptions that take precedence over club defaults.
- **`travel_cache`** — Cached travel times keyed by postcode district + venue_id.
- **`corrections`** — User-submitted data corrections saved as pending review; never auto-applied.

### Pyramid Structure

- **`pyramid_templates`** — Pyramid definitions (currently "mens"), with active/retired status.
- **`pyramid_divisions`** — Division records linked to templates, with level, max_size, and display_order.
- **`pyramid_edges`** — Promotion/relegation connections between divisions, with allocation_type (fixed/allocation_dependent), notes, and source_url.
- **`pyramid_seasons`** — Season snapshots linked to templates.
- **`division_assignments`** — Current club-to-division mappings (replaced `pyramid_season_memberships` in migration 020). Each club has at most one active assignment.
- **`club_venue_assignments`** — Historical club-to-venue relationships with effective date ranges.
- **`division_competition_mappings`** — Links between pyramid divisions and competition codes for publishing.
- **`movement_slots`** — Staged promotion/relegation/migration positions for end-of-season movements.

### Fixture Import Pipeline

- **`fixture_seasons`** — Season definitions with label, date range, and current flag. Fixtures reference `season_label`.
- **`fixture_sources`** — Registered import sources with type (api_feed/agent_scrape/url_table_scrape/csv_upload/csv_paste/manual), trust level, auto-approval, and failure tracking.
- **`import_batches`** — Import job records linked to sources, with parse/approval status, row counts, and raw payload storage.
- **`import_batch_rows`** — Normalized import rows with participant resolution, competition/venue matching, confidence, match_result, and final_action.
- **`import_batch_issue_resolutions`** — Per-batch issue tracking with issue codes, resolution types, and actor notes.
- **`import_batch_row_actions`** — Explicit actions taken on import rows (import_insert, import_update, skip, edit_row).

### Admin & Aliases

- **`admin_audit_log`** — Audit trail for all admin mutations with actor, action, entity type/id, before/after JSON, and timestamp.
- **`club_aliases`** — Scoped club name aliases for import matching, with competition scoping, normalization, and retirement support.

## Pricing Precedence

1. `fixture_ticket_price_overrides` — fixture-specific exceptions (highest priority)
2. `club_ticket_prices` — club-level defaults
3. Unknown/unset — displayed as "price unknown" with disclaimer

## Key Rules

- Premier League club/ground seed data lives in `data/clubs.csv` (imported with `npm run import:clubs`).
- Championship club seed data lives in `data/championship-clubs.csv`.
- Clubs store `football_data_team_id` and `aliases` for reliable import matching.
- Historical demo fixtures are flagged with `is_demo_data` and `is_historical`.
- Imported fixtures use `source = 'football-data'`, upserted by `source_id`, with `source_updated_at` and `imported_at`.
- Travel cache is keyed by postcode district and venue_id.
- Corrections are saved as `pending`; they never update live data automatically.
- Admin audit rows record manual admin mutations and security-relevant admin actions.
- The men's pyramid is seeded as a reusable static template from Premier League through Step 3 (Level 10).
- Pyramid seasons and divisions start `open`; they can be marked `locked` when a snapshot is complete.
- `pyramid_clubs` is sparse by design, so clubs can be added later without requiring a full division.
- Validation treats duplicate club placement, over-capacity, unknown divisions, template mismatches, and invalid movements as errors.
- `movement_slots` stores staged movements with at most one club per slot.
- The D1 seed path wraps the full bootstrap in a transaction so a failure rolls back cleanly.

## Retired Tables

The following tables were dropped in migration 023 (`retire-season-tables.sql`):

- `pyramid_season_memberships` — replaced by `division_assignments`
- `pyramid_season_divisions` — replaced by `division_assignments` + `pyramid_divisions`
- `pyramid_movements` — replaced by `movement_slots`

These may still exist in older local databases; migrations 020–022 handle the backfill path.
