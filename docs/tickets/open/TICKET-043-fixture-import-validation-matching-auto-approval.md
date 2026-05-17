# TICKET-043: Fixture Import Validation, Matching, And Auto-Approval Gates

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-037, TICKET-038, TICKET-039, TICKET-040, TICKET-042

## Purpose

Validate normalized fixture import rows, match them to public entities, and safely auto-approve trusted source rows that are structurally sound.

## Work

- Validate required fixture row fields after source adapter normalization.
- Resolve home and away participants through mappings, source IDs, canonical club names, scoped aliases, or explicit one-off team markers.
- Require unknown team names to be resolved as mapped clubs or explicitly marked as one-off teams before approval.
- Do not infer one-off teams automatically from unknown names.
- Resolve competition through public competition mappings.
- Resolve venue from explicit venue text or mapped home club primary venue fallback.
- Require an explicit matched venue when the home participant is a one-off team.
- Apply assumed kickoff time rules for missing times.
- Detect existing fixtures by home participant, away participant, competition, and season.
- Treat kickoff date/time and status as updateable fields, not identity fields.
- Implement latest-import-wins behavior for explicitly provided fields.
- Prevent blank import fields from erasing existing values.
- Block auto-approval for structurally unsafe rows:
  - unknown or unmapped clubs unless explicitly marked as one-off teams with sufficient evidence
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

- Matching tests for canonical, alias, scoped alias, ambiguous, unknown clubs, and explicit one-off teams.
- Validation tests proving unknown names are not auto-converted into one-off teams.
- Venue validation tests proving home one-off fixtures require explicit matched venues.
- Venue fallback and unmatched venue tests.
- Duplicate/update detection tests.
- Auto-approval gate tests for API and agent sources.
- Tests proving blank fields do not erase existing data.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
