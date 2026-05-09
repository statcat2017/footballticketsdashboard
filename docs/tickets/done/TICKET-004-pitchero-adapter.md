# TICKET-004: Build Pitchero Club Adapter Pattern

Status: done
Owner role: Backend ingestion
Priority: P1
Depends on: TICKET-002

## Goal

Create a reusable adapter pattern for Pitchero-hosted club fixture, admission, contact, and match-centre pages.

## Scope

- In scope:
  - Fixture list extraction.
  - Venue extraction where present.
  - Admission-page extraction.
  - Match-centre ticket-note extraction.
- Out of scope:
  - Login, admin, or protected Pitchero areas.
  - Non-Pitchero club sites.

## Acceptance Criteria

- Adapter handles at least three fixture/admission fixtures from Step 3 research.
- Empty fixture lists return a valid empty result, not an error.
- Match-centre ticket notes override static admission only when explicit.

## Implementation Notes

- Useful examples: Aveley, Cray Valley PM, Lancaster City, Barwell, Potters Bar Town.

## Resolution

- Added `pitcheroClubAdapter` and parser helpers in `lib/ingestion/pitchero-club.ts`.
- Supports public Pitchero fixture cards, admission price pages, empty fixture pages, and match-centre fixture overrides.
- Preserves outbound ticket/match-centre links as leads without entering protected areas.
- Added tests for admission parsing, fixture cards, empty pages, and explicit match-centre overrides.

## Tests

- Fixture list parser tests.
- Admission page parser tests.
- Empty fixture page test.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
