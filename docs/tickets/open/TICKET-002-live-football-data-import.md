# TICKET-002: Live Football-Data Import

Status: in-progress
Owner: Backend
Priority: high
Depends on: TICKET-001

## Purpose

Replace purely historical/demo fixtures with real Premier League and Championship fixtures when football-data.org has data available.

## Work

- Add a football-data.org importer for `PL` and `ELC`.
- Read `FOOTBALL_DATA_API_TOKEN`.
- Upsert fixtures by source and source ID.
- Preserve historical/demo fixtures for close-season fallback.
- Record source and import timestamps.

## Acceptance Criteria

- Import can be run manually without affecting demo fallback.
- Missing token produces a clear error.
- Fixture imports are idempotent.

## Verification

- Unit tests with mocked football-data responses.
- Manual import in an environment with token.

## Backend Update

- Added `npm run import:football-data`.
- Import reads `FOOTBALL_DATA_API_TOKEN`, fetches `PL` and `ELC` matches from football-data.org, and upserts known-club fixtures into SQLite with `source_updated_at` and `imported_at`.
- Matches for clubs not yet present in the local club/venue table are skipped because the current schema requires a venue with postcode coordinates.
- User search still reads SQLite only; it does not call football-data live.
