# SQLite Schema

The app initializes SQLite automatically from `lib/db/schema.ts`.

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
- Historical demo fixtures are flagged with `is_demo_data` and `is_historical`.
- Travel cache is keyed by postcode district and venue.
- Corrections are saved as `pending`; they never update live data automatically.
