# TICKET-038: Fixture Season, Time, Provenance, And Confidence Schema

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-036, TICKET-037

## Purpose

Add the fixture schema needed for reliable duplicate detection, moved-fixture updates, assumed kickoff times, and explainable provenance.

## Work

- Add a lightweight `fixture_seasons` table with label, start date, end date, current flag, and timestamps.
- Link fixtures and import batches to a fixture season.
- Add fixture fields for separate fixture date and kickoff time.
- Add a kickoff time status such as `confirmed`, `assumed`, or `unknown`.
- Preserve or derive `kickoff_at` when both date and time are available.
- Treat imported date/time values as UK local time unless a source explicitly provides a timezone.
- Add source and provenance fields needed by fixtures, fixture ticket overrides, and related admin flows.
- Standardize confidence values across fixture-related data: `verified`, `imported`, `inferred`, `approximate`, and `unknown`.
- Migrate existing `seed` confidence values to the new model or provide a compatibility mapping.
- Add indexes supporting fixture identity by home, away, competition, and season.

## Acceptance Criteria

- Duplicate/update detection can use home club, away club, competition, and season.
- Kickoff date can be represented even when a supplied time is missing.
- Missing kickoff times can be stored as assumed weekend 15:00 or midweek 19:45.
- Assumed times are visible to public display and data-quality checks.
- Provenance fields can explain where fixture data came from and when it was verified or imported.

## Verification

- Schema setup/migration tests.
- Date/time parsing tests for UK-local imports.
- Assumed-time rule tests for weekend and midweek fixtures.
- Confidence migration or compatibility tests.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
