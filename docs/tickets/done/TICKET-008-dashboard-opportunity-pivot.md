# TICKET-008: Pivot Dashboard To Ticket Opportunities

Status: done
Owner role: Frontend
Priority: P2
Depends on: TICKET-001, TICKET-002

## Goal

Update the dashboard to present ticket opportunities instead of confirmed live ticket availability.

## Scope

- In scope:
  - Wording changes.
  - Result cards for opportunity leads.
  - Unknown price/sale-state display.
  - Source confidence and provenance display.
  - Official purchase/info link display.
- Out of scope:
  - New visual design system.
  - Live inventory display.
  - Adapter implementation.

## Acceptance Criteria

- Users can distinguish pay-on-gate, available lead, not-on-sale, unknown, and explicit sold-out.
- Unknown price is displayed honestly.
- Concession fit for user age is visible when known.
- Existing seed demo still works or is replaced with opportunity seed data.

## Implementation Notes

- Avoid claiming tickets are available unless the source explicitly says so.

## Resolution

- Added `RankedTicketOpportunityResult` as the UI/API display DTO.
- Added `rankTicketOpportunityLeads` alongside legacy seed `rankTickets`.
- Updated `POST /api/search` to run the Dulwich Hamlet official adapter and rank returned opportunity leads.
- Updated `SearchDashboard` wording and cards to show ticket opportunities, nullable prices/kickoffs/venues, sale labels, source links, and honest empty states.
- Updated Playwright coverage to assert the opportunity dashboard flow.

## Tests

- Component tests for opportunity states.
- Playwright search flow for opportunity results.

## Docs To Update

- `docs/workstreams/frontend.md`
- `docs/workstreams/ranking.md`
