# TICKET-038: Fixture Season, Time, Provenance, And Confidence Schema

Status: schema-complete
Owner: Backend
Priority: high
Depends on: TICKET-036, TICKET-037

## Purpose

Add the fixture schema needed for reliable duplicate detection, moved-fixture updates, one-off fixture teams, assumed kickoff times, and explainable provenance.

## What Is Done

- `fixture_seasons` table with label, start/end dates, current flag. Fixtures reference `season_label`.
- One-off fixture participant support: `home_one_off`, `away_one_off`, `home_one_off_name`, `away_one_off_name`, `home_one_off_source`, `away_one_off_source`, with CHECK constraints ensuring mutual exclusion with club IDs.
- Fixture date/time split: `fixture_date`, `kickoff_time`, `kickoff_time_status` (`confirmed`, `assumed`, `unknown`). `kickoff_at` derived when both are available.
- Confidence enum normalised across fixtures, ticket prices, and overrides: `verified`, `imported`, `inferred`, `approximate`, `unknown`.
- Provenance fields: `source_url`, `verified_at`, `notes`, `source_updated_at`, `imported_at`.
- Fixture identity index on `(home_club_id, away_club_id, competition_code, season_label)`.
- `seed` confidence values migrated to `imported` during migration 010.

## What Remains (Tracked In Sprint 2 Tickets)

- Assumed-time rule service logic (weekend 15:00, midweek 19:45) — part of validation service.
- Use of one-off participants in fixture admin CRUD (TICKET-045 — deferred after Sprint 2).

## Acceptance Criteria

- Duplicate/update detection can use home participant, away participant, competition, and season (schema done).
- Admin/import flows can create fixtures involving one-off teams without creating permanent club records (schema done).
- Kickoff date can be represented even when a supplied time is missing (schema done).
- Missing kickoff times can be stored as assumed weekend 15:00 or midweek 19:45 (service — Sprint 2).
- Provenance fields can explain where fixture data came from and when it was verified or imported (schema done).

## Verification

- Schema setup/migration tests done.
- Date/time parsing tests done.
- Confidence migration done.

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Sprint 2: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
