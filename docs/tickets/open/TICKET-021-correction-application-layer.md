# TICKET-021: Correction Application Layer

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-018, TICKET-019

## Purpose

Apply validated corrections safely to the live data model used by search and display.

## Work

- Map validated corrections onto the current database model for clubs, venues, pricing, and fixture-level overrides.
- Support updates to sale mode, adult price, concession price, source URL, and verification metadata where applicable.
- Distinguish club-default changes from fixture-specific overrides.
- Ensure applied corrections update displayed search results consistently.
- Preserve before-and-after state so applied corrections can be audited.

## Acceptance Criteria

- Validated corrections update the correct live records.
- Club-default and fixture-specific pricing changes are applied to the right tables.
- Applied corrections are traceable with before-and-after provenance.

## Verification

- Data application tests.
- Search result regression tests after correction application.
- Audit trail check for applied changes.
