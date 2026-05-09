# Step 3 Club Swarm Coverage

Research date: 2026-05-09.

Status: Step 3 public ticket opportunity research is covered across all four divisions:

- Isthmian League Premier Division: `docs/research/isthmian-premier-club-swarm.md`
- Northern Premier League Premier Division: `docs/research/northern-premier-club-swarm.md`
- Southern League Premier Central: `docs/research/southern-premier-central-club-swarm.md`
- Southern League Premier South: `docs/research/southern-premier-south-club-swarm.md`

## Coverage Summary

| Division | Clubs covered | Strong first candidates | Main patterns |
| --- | ---: | --- | --- |
| Isthmian Premier | 22 | Dulwich Hamlet, Chatham Town, Brentwood Town, Cheshunt, Cray Valley PM, Folkestone Invicta, Welling United, Wingate & Finchley | Fanbase, Ktckts, Pitchero, static admission pages, club news |
| Northern Premier Premier | 21 reviewed from current table/list | Ashton United, FC United, Gainsborough Trinity, Hednesford, Lancaster City, Rushall Olympic, Stockton Town, Warrington Town, Whitby Town | Ktckts, Fanbase, Pitchero, static admission pages, matchday news |
| Southern Premier Central | 22 | Banbury United, Bury Town, Needham Market, Real Bedford, Redditch United, Royston Town, Stourbridge, Halesowen, Kettering, Worcester | Ktckts, Fanbase, Ticket Tailor, TicketCo, FIXR, Flicket, Pitchero |
| Southern Premier South | 22 | Bracknell Town, Dorchester Town, Havant & Waterlooville, Hanwell Town, Poole Town, Taunton Town, Weymouth, Wimborne Town | Fanbase, Ktckts, TicketCo, FIXR, Upfan, Shopify, WeGotTickets, static pages |

Note: the Northern Premier League table/list available during research showed 21 active clubs after Widnes resigned. Treat this as a DBA/orchestrator check before building any league-wide coverage metric.

## Key Finding

Step 3 strongly validates the scaled-back product scope. Public ticket opportunity ingestion is viable across most clubs without attempting protected live inventory scraping.

Common reliable fields:

- Fixture and opponent.
- Venue and postcode.
- Adult/concession/youth/child price bands.
- Online vs gate price split.
- Pay-on-gate or ticket-office rules.
- Public purchase links.
- Coarse sale-state labels such as not on sale, unavailable, no products, all-ticket, no gate sales, or sold out when explicit.
- Concession/age rules and ID requirements.

Common weak fields:

- Exact live availability.
- Remaining capacity.
- Seat maps.
- Checkout/basket state.
- Exact off-sale times unless explicitly published.
- Current-season price freshness where clubs leave old pages online.

## Shared Adapter Roadmap

Build platform and page-pattern adapters before club-specific adapters:

1. `TicketOpportunityLead` data model with provenance.
2. `staticAdmissionPageAdapter`.
3. `pitcheroClubAdapter`.
4. `fanbasePublicEventAdapter`.
5. `ktcktsPublicEventAdapter`.
6. `clubNewsTicketInfoAdapter`.
7. `ticketTailorPublicEventAdapter`.
8. `ticketCoPublicEventAdapter`.
9. `fixrPublicEventAdapter`.
10. Narrower adapters: `flicketPublicTicketOfficeAdapter`, `upfanPublicEventAdapter`, `shopifyTicketProductAdapter`, `weGotTicketsPublicEventAdapter`.

## DBA Requirements

Before implementation, define:

- Canonical `TicketOpportunityLead`.
- Source provenance fields: source URL, adapter ID, parser version, observed/fetched timestamps, confidence.
- Price precedence: fixture/event page, current official price page, official news post, trusted opponent guide, manual seed.
- Sale-state vocabulary that separates lead state from live inventory.
- Season freshness handling.
- Venue/postcode normalization and conflict resolution.
- Online vs gate price representation.
- Conditional child/free-ticket eligibility.
- Fixture-specific overrides for all-ticket, segregation, no-gate-sales, and cup pricing.

## Implementation Priority

Recommended first Step 3 clubs:

1. Dulwich Hamlet.
2. Bracknell Town.
3. Chatham Town.
4. Banbury United.
5. Needham Market.
6. Stockton Town.
7. Dorchester Town.
8. Real Bedford.
9. Havant & Waterlooville.
10. Welling United.

These give broad coverage of the recurring source types while staying within public opportunity data.
