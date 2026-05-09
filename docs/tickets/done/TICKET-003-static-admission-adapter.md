# TICKET-003: Build Static Admission Page Adapter Pattern

Status: done
Owner role: Backend ingestion
Priority: P1
Depends on: TICKET-002

## Goal

Create a reusable parser pattern for club pages that publish static admission prices and concession rules.

## Scope

- In scope:
  - Parse public HTML fixtures for labelled GBP price bands.
  - Capture concession age/group rules.
  - Capture pay-on-gate notes.
  - Emit `TicketOpportunityLead` policy enrichment.
- Out of scope:
  - PDF parsing.
  - Event-platform parsing.
  - Club-specific adapters beyond test fixtures.

## Acceptance Criteria

- Parser handles representative Step 3 static admission HTML.
- Parser marks stale or season-labelled pages when visible.
- Parser does not infer sale state from price pages alone.

## Implementation Notes

- Use Dulwich Hamlet, Welling United, and Poole Town research as examples.

## Resolution

- Added `parseStaticAdmissionPolicy` in `lib/ingestion/static-admission.ts`.
- Parses labelled GBP admission prices, season labels, concession groups, ID requirements, U13-with-paying-adult rules, pay-on-turnstiles text, and official ticket links.
- Static price pages produce policy enrichment and do not prove fixture-specific live availability.
- Added parser tests using representative Dulwich Hamlet Step 3 HTML.

## Tests

- Price parsing tests.
- Concession rule tests.
- stale-season marker tests.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
