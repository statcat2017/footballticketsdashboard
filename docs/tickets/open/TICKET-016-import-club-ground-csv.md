# TICKET-016: Import Club And Ground CSV

Status: review
Owner: Backend
Priority: high
Depends on: TICKET-003

## Purpose

Use the researched Premier League `data/clubs.csv` as the source of truth for clubs, venues, ticket URLs, and football-data IDs.

## Work

- Add an `npm run import:clubs` command.
- Validate the CSV header and required fields.
- Upsert venues from `ground_name`, `postcode`, `latitude`, and `longitude`.
- Upsert clubs from `club_name`, `competition`, `official_site_url`, and `ticket_url`.
- Store or use `football_data_team_id` and aliases for reliable fixture importer matching.
- Document any rows that fail validation.

## Acceptance Criteria

- Importing the CSV is idempotent.
- Premier League football-data fixture imports no longer skip known PL clubs due to missing local club/venue records.
- Invalid postcode, coordinate, URL, or duplicate club rows fail loudly.

## Verification

- Unit tests with a small fixture CSV.
- `npm run import:clubs`
- `npm run import:football-data` shows materially fewer skipped PL fixtures.

## Backend Update

- Added `npm run import:clubs`.
- Added CSV validation and idempotent club/venue imports from `data/clubs.csv`.
- Added `football_data_team_id` and aliases to club storage.
- Updated the football-data importer to match by team ID before aliases/name.
