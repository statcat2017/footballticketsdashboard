# TICKET-012: Non-League Fixture Adapter Spike

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-011

## Purpose

Prepare the codebase for partner/API fixture data without committing to a specific non-league source before access is known.

## Work

- Define a generic fixture-source interface.
- Map external teams, competitions, venues, and kickoff/status into existing SQLite tables.
- Add tests using synthetic Step 1-3 fixture payloads.
- Document what real source fields are required.

## Acceptance Criteria

- Adding Football Web Pages or another approved source does not require rewriting search/UI.
- Synthetic non-league fixtures can be inserted and searched.
- Missing venue or price data stays explicit.

## Verification

- Unit tests with synthetic source payloads.
