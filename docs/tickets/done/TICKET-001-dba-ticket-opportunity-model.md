# TICKET-001: Define Ticket Opportunity Data Model

Status: done
Owner role: DBA
Priority: P0
Depends on: none

## Goal

Define the canonical data model for public football ticket opportunity ingestion.

## Scope

- In scope:
  - `TicketOpportunityLead` fields.
  - price-band representation.
  - sale-state vocabulary.
  - concession and eligibility representation.
  - source provenance and confidence.
  - venue/postcode requirements.
  - stale-source handling.
- Out of scope:
  - Implementing source adapters.
  - Frontend changes.
  - Database migrations.

## Acceptance Criteria

- A DBA-approved model is documented.
- Unknown, inferred, manual, static-policy, event-page, and live-observed values are distinguishable.
- Sale states cannot be confused with live inventory.
- Price precedence rules are defined.
- Venue/postcode conflict rules are defined.

## Implementation Notes

- Use Step 3 research reports as examples.
- Include Dulwich Hamlet as the primary worked example.

## Resolution

- Added the DBA-approved canonical model in `docs/data-model/ticket-opportunity-lead.md`.
- Updated `docs/workstreams/data-ingestion.md` to require `TicketOpportunityLead` as the adapter output contract.
- Updated `docs/workstreams/ranking.md` to define ranking semantics for public opportunity leads.
- Added the canonical model reference to `docs/project-plan.md`.

## Tests

- No runtime tests required for this documentation ticket.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
- `docs/workstreams/ranking.md`
- optionally `lib/types.ts` in a follow-up implementation ticket, not this ticket.
