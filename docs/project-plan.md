# Football Ticket Opportunity Dashboard Project Plan

## Summary

Build a UK football ticket opportunity dashboard. Users enter a postcode and age; the app returns nearby football fixtures with public ticket opportunity data: prices or price bands, on-sale/off-sale state, pay-on-gate rules, concession eligibility, source confidence, and official purchase/info links.

The product no longer depends on scraping protected live inventory from Premier League-style ticket portals. The value is breadth across lower-pyramid clubs where public fixture, admission, and ticketing data is easier to ingest reliably.

## V1 Scope

- Next.js + TypeScript dashboard.
- Postcode and age search.
- `TicketOpportunityLead` as the primary ingestion object.
- Clear distinction between public leads, confirmed ticket offers, manual seed data, and unknown values.
- Step 3 as the first data coverage target, using the completed Club Swarm research reports.
- Reusable source adapters for common public patterns:
  - static admission pages
  - Pitchero club pages
  - Fanbase public events
  - Ktckts/Kaizen public events
  - club news and matchday posts
- Ranking by distance, fixture relevance, price fit, source quality, sale-state usefulness, and age/concession fit.

Out of scope for V1:

- Protected live inventory scraping.
- Account, queue, seat-map, basket, checkout, or ticket-exchange automation.
- Unofficial resale ingestion unless explicitly approved later.

## Implementation Roadmap

1. Data model and DBA rules.
   - Define `TicketOpportunityLead`, sale-state vocabulary, price-band model, eligibility/concession model, venue identity, provenance, confidence, and source freshness rules.
   - Define price precedence: fixture/event page, current official price page, official news post, trusted opponent guide, manual seed.

2. Backend ingestion foundation.
   - Add `TicketSourceAdapter`.
   - Add source registry.
   - Add adapter diagnostics and compliance guards.
   - Add fetch/cache policy.
   - Keep `TicketResult` separate from opportunity leads.

3. Shared source adapters.
   - Build `staticAdmissionPageAdapter`.
   - Build `pitcheroClubAdapter`.
   - Build `fanbasePublicEventAdapter`.
   - Build `ktcktsPublicEventAdapter`.
   - Build `clubNewsTicketInfoAdapter`.

4. First club adapters.
   - Dulwich Hamlet.
   - Bracknell Town.
   - Chatham Town.
   - Banbury United.
   - Needham Market.

5. Dashboard pivot.
   - Update labels from ticket availability to ticket opportunities.
   - Show fixture, venue/distance, sale state, price bands, concessions, confidence, and official link.
   - Make unknown values explicit rather than hiding or inventing them.

6. QA and parser hardening.
   - Add fixture-based parser tests.
   - Add adapter contract tests.
   - Add Playwright coverage for lead search and result display.
   - Add stale-source and no-events scenarios.

## Research Inputs

- Canonical opportunity model: `docs/data-model/ticket-opportunity-lead.md`
- Step 3 coverage index: `docs/research/step-three-coverage.md`
- Isthmian Premier: `docs/research/isthmian-premier-club-swarm.md`
- Northern Premier: `docs/research/northern-premier-club-swarm.md`
- Southern Premier Central: `docs/research/southern-premier-central-club-swarm.md`
- Southern Premier South: `docs/research/southern-premier-south-club-swarm.md`
- Dulwich implementation spec: `docs/research/dulwich-hamlet-ingestion-spec.md`

## Ticket System

Implementation is controlled through `docs/tickets`.

- `docs/tickets/open`: active backlog.
- `docs/tickets/done`: completed tickets.
- `docs/tickets/templates/ticket.md`: ticket format.
- `docs/tickets/README.md`: workflow and status rules.

Each implementation change should reference one ticket. Tickets should stay small enough for one focused agent or one human PR.

## Risks

- Public club pages change structure without warning.
- Some clubs keep stale admission pages online.
- Sale-state labels vary across platforms and must not be overinterpreted.
- Venue postcode conflicts need DBA review before distance ranking.
- Event platform terms and robots behavior may vary; adapters must fail closed.
