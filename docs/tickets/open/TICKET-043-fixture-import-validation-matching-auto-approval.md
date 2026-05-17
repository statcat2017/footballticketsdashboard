# TICKET-043: Fixture Import Validation, Matching, And Auto-Approval Gates

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-037, TICKET-038, TICKET-039, TICKET-040, TICKET-042

## Purpose

Validate normalized fixture import rows, match them to public entities, and safely auto-approve trusted source rows that are structurally sound.

## Work

- Validate required fixture row fields after source adapter normalization.
- Resolve home and away clubs through mappings, source IDs, canonical names, and scoped aliases.
- Resolve competition through public competition mappings.
- Resolve venue from explicit venue text or home club primary venue fallback.
- Apply assumed kickoff time rules for missing times.
- Detect existing fixtures by home club, away club, competition, and season.
- Treat kickoff date/time and status as updateable fields, not identity fields.
- Implement latest-import-wins behavior for explicitly provided fields.
- Prevent blank import fields from erasing existing values.
- Block auto-approval for structurally unsafe rows:
  - unknown or unmapped clubs
  - unmatched explicit venues
  - missing or invalid venue coordinates
  - ambiguous aliases
  - fixture identity conflicts
  - destructive blank overwrites
  - impossible dates
  - weak or missing agent evidence below the source threshold
- Allow auto-approval with warnings for assumed kickoff time, missing ticket info, approximate coordinates, and missing travel cache.
- Record all row decisions and warnings in import row outcomes.

## Acceptance Criteria

- Trusted API rows that pass structural gates can auto-approve.
- Trusted agent rows that pass structural gates and evidence requirements can auto-approve.
- Rows that fail structural gates are not auto-approved and remain reviewable.
- Fixture moves update the existing fixture and record before/after values.
- Missing import fields do not erase existing ticket, venue, source, or note data.

## Verification

- Matching tests for canonical, alias, scoped alias, ambiguous, and unknown clubs.
- Venue fallback and unmatched venue tests.
- Duplicate/update detection tests.
- Auto-approval gate tests for API and agent sources.
- Tests proving blank fields do not erase existing data.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
