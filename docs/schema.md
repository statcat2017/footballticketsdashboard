# SQLite Schema

Run `npm run db:setup` to create or update `data/nearmefc.sqlite`, apply the schema from `lib/db/schema.ts`, and seed demo data. The setup is idempotent, so it can be rerun safely.

To reset local data, delete `data/nearmefc.sqlite` and run `npm run db:setup` again. The SQLite file and WAL/SHM sidecars are ignored by git.

Core tables:

- `competitions`
- `pyramid_templates`
- `pyramid_divisions`
- `pyramid_edges`
- `pyramid_seasons`
- `pyramid_season_divisions`
- `pyramid_clubs`
- `pyramid_season_memberships`
- `pyramid_movements`
- `venues`
- `clubs`
- `fixtures`
- `club_ticket_prices`
- `fixture_ticket_price_overrides`
- `travel_cache`
- `corrections`

Important rules:

- Club ticket prices store the default `adult`, `concession`, and `sale_mode` values for each club.
- Fixture-specific offers or exceptions are stored in `fixture_ticket_price_overrides` and take precedence over the club default.
- `admission_prices` remains as a legacy table for migration compatibility with older local databases.
- Premier League club/ground seed data lives in `data/clubs.csv` and can be imported with `npm run import:clubs`.
- Clubs store `football_data_team_id` and aliases so live fixture imports can match teams reliably.
- Historical demo fixtures are flagged with `is_demo_data` and `is_historical`.
- Imported fixtures use `source = 'football-data'`, are upserted by `source_id`, and record `source_updated_at` plus `imported_at`.
- Travel cache is keyed by postcode district and venue.
- Corrections are saved as `pending`; they never update live data automatically.
- The men's pyramid is seeded as a reusable static template from Premier League through Step 3.
- Pyramid seasons and divisions start `open`; they can be marked `locked` when a snapshot is complete.
- `pyramid_clubs` is sparse by design, so clubs can be added later without requiring a full division.
- Validation treats duplicate club placement, over-capacity, unknown divisions, template mismatches, and invalid movements as errors.
