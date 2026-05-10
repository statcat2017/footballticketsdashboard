# SQLite Schema

Run `npm run db:setup` to create or update `data/nearmefc.sqlite`, apply the schema from `lib/db/schema.ts`, and seed demo data. The setup is idempotent, so it can be rerun safely.

To reset local data, delete `data/nearmefc.sqlite` and run `npm run db:setup` again. The SQLite file and WAL/SHM sidecars are ignored by git.

Core tables:

- `competitions`
- `venues`
- `clubs`
- `fixtures`
- `admission_prices`
- `travel_cache`
- `corrections`

Important rules:

- Fixture prices are not stored directly. Admission prices are club-level guide prices.
- Premier League club/ground seed data lives in `data/clubs.csv` and can be imported with `npm run import:clubs`.
- Clubs store `football_data_team_id` and aliases so live fixture imports can match teams reliably.
- Historical demo fixtures are flagged with `is_demo_data` and `is_historical`.
- Imported fixtures use `source = 'football-data'`, are upserted by `source_id`, and record `source_updated_at` plus `imported_at`.
- Travel cache is keyed by postcode district and venue.
- Corrections are saved as `pending`; they never update live data automatically.
