# TICKET-007: Implement Dulwich Hamlet Opportunity Adapter

Status: done
Owner role: Club Swarm Backend ingestion
Priority: P1
Depends on: TICKET-002, TICKET-003, TICKET-005

## Goal

Implement the first production-style club adapter using the Dulwich Hamlet ingestion spec.

## Scope

- In scope:
  - Official fixture pages.
  - Official ticket-prices page.
  - Official news fallback.
  - Officially linked Fanbase enrichment.
- Out of scope:
  - Checkout, quantity, basket, account, or live inventory.
  - Other clubs.

## Acceptance Criteria

- Adapter emits Dulwich ticket opportunity leads for home fixtures.
- Static men's and women's prices are represented.
- Concession and U13-with-paying-adult rules are represented.
- Pay-on-gate is represented.
- Missing fixtures or no-fixtures state returns a valid empty success.

## Implementation Notes

- Source spec: `docs/research/dulwich-hamlet-ingestion-spec.md`.

## Resolution

- Added `dulwichHamletOfficialOpportunityAdapter` in `lib/ingestion/dulwich-hamlet.ts`.
- Fetches official Dulwich Hamlet ticket-prices, men's fixtures, and women's fixtures pages.
- Applies static men's and women's price bands, concession rules, U13-with-paying-adult eligibility, and pay-on-turnstiles policy to parsed fixture leads.
- Treats the current live no-fixtures state as a successful empty ingest with diagnostics rather than invented fixtures.
- Added Dulwich parser tests for no-fixtures and representative home fixture cards.

## Tests

- Men's fixture fixture-file parser test.
- Women's fixture parser test.
- Ticket prices parser test.
- Fanbase enrichment allowed/fail-closed test.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
- `docs/research/dulwich-hamlet-ingestion-spec.md` if implementation discovers deviations.
