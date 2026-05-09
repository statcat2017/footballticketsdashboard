# Isthmian League Premier Division Club Swarm Research

Research date: 2026-05-09.

Scope: public ticket opportunity data for the 2025-26 Isthmian League Premier Division. This follows the revised product direction: fixtures, venue/postcode, public price bands, concessions, sale/off-sale markers where public, pay-on-gate rules, purchase links, and public event-platform pages. It does not target protected live inventory, seat maps, checkout, baskets, or account-only flows.

Team basis: Dulwich Hamlet's official 2025-26 Isthmian League teams page lists Aveley, Billericay Town, Brentwood Town, Burgess Hill Town, Canvey Island, Carshalton Athletic, Chatham Town, Cheshunt, Chichester City, Cray Valley PM, Cray Wanderers, Dartford, Dulwich Hamlet, Folkestone Invicta, Hashtag United, Lewes, Potters Bar Town, Ramsgate, St Albans City, Welling United, Whitehawk, and Wingate & Finchley.

## Summary

This league is a strong fit for the scaled-back ticket opportunity product. Most clubs expose enough public data to build useful local ticket leads without touching protected portals:

- Public fixture pages are common.
- Admission prices and concession rules are commonly public.
- Venue postcodes are usually available.
- Fanbase, Ktckts/Kaizen, Ticket Tailor, and Pitchero patterns repeat across clubs.
- Pay-on-gate rules are often explicit.
- Sale-state signals are usually coarse and must not be treated as live inventory.

Best first implementation candidates:

- Dulwich Hamlet: official fixture HTML plus prices/concessions and Fanbase links.
- Chatham Town: official prices plus Fanbase fixture/match-centre metadata.
- Brentwood Town: official prices plus Fanbase fixture purchase links.
- Cheshunt: Ktckts event pages expose fixture-specific prices and sale markers.
- Cray Valley PM: Pitchero match-centre pages plus Fanbase links.
- Folkestone Invicta: matchday info posts with prices, pay-on-gate notes, and Fanbase links.
- Wingate & Finchley: fixture table, ticket page, advance/gate prices, and sale-state nuance.
- Welling United: fixtures, prices, pay-on-gate rules.
- Billericay Town: Ktckts event pages plus official venue/fixtures.
- Whitehawk and St Albans City: Ktckts plus public prices.

## Club Findings

| Club | Venue / postcode | Public opportunity fields | Recommendation |
| --- | --- | --- | --- |
| Aveley FC | Parkside, Park Lane, Aveley, RM15 4PX | Pitchero fixtures, 2025-26 admission prices: adult £14, concession £10, U16 £5. Cup prices may vary. | Stable HTML + fixture-link lead. |
| Billericay Town | New Lodge, Blunts Wall Road, Billericay, CM12 9SA | Official fixtures, Ktckts event pages, public no-products/limited markers, current price corroboration from away guide. | Public event-platform adapter + stable HTML fallback. |
| Brentwood Town | The Arena, Brentwood Centre, CM15 9NN | Official ticketing page, 2025-26 announcement, adult £12, concession £8, U18/free with adult, Fanbase links. | Public event-platform adapter. |
| Burgess Hill Town | Medical Travel Compared Stadium, Maple Drive, RH15 8AQ | Fixtures/results, admission prices: adult £12, concession £8, 12-18 £3, U11 £1. | Stable HTML. |
| Canvey Island | Steves Taxis Stadium, Park Lane, SS8 7PX | Pitchero fixtures, older labelled admission page: adult £12, concession £8, U16 £3. | Stable HTML with freshness caveat. |
| Carshalton Athletic | War Memorial Sports Ground, SM5 2PW | Online/turnstile rules, FASTLANE, U5 free, U16 accompanied, matchday guide prices, public form. Current prices partly image/form based. | Fixture-link lead + semi-structured form. |
| Chatham Town | Bauvill Stadium / Sports Ground, ME4 6LR | Official prices: men adult £15, concession £10, U16 £5; women adult £8, concession £5, U16 £3. Fanbase fixture IDs and unavailable markers. | Public event-platform adapter + stable HTML. |
| Cheshunt | The Stadium, Theobalds Lane, EN8 8RU | Official rules plus Ktckts events with fixture name/date/venue, prices, public-sale/unavailable markers, ticket-office cutoff text. | Public event-platform adapter + stable HTML lead. |
| Chichester City | Oaklands Park, postcode needs venue seed | Fixture list, admission prices: adult £12, concession £8, students/16-18 £4, U16 £3, youth parent £5. | Stable HTML + fixture-link lead. |
| Cray Valley PM | The Artic Stadium, Badger Sports, SE9 5HP | Pitchero fixtures and match-centre previews with venue, kickoff, admission, restrictions, Fanbase purchase links. | Stable HTML + public event-platform adapter. |
| Cray Wanderers | Flamingo Park, BR7 6HL | WordPress match previews with fixture, date, venue, prices, online ticket URLs; Fanbase links sometimes indexed. | Fixture-link lead + stable news HTML. |
| Dartford | Bericote Powerhouse Princes Park, DA1 1RT | Static prices: adult £15, concession £10, youth 13-16 £5, U13 free; Fanbase links for matchday/event tickets. | Public event-platform adapter + stable HTML. |
| Dulwich Hamlet | Champion Hill, SE22 8BD | Official fixture pages, prices, concessions, pay-on-gate, Fanbase links. Detailed spec exists separately. | Stable HTML + Fanbase enrichment. |
| Folkestone Invicta | Alcaline Stadium, CT19 5JU | Matchday info posts with fixture, ticket link, gate opening, pay-on-gate, prices, parking, programme. Fanbase used. | Stable HTML + public event-platform adapter. |
| Hashtag United | Parkside, RM15 4PX | Official source weak. Reliable public ticket data mostly from opponent/host previews: fixture, venue, admission, gate opening, payment notes. | Manual seed / low-priority fixture-link lead. |
| Lewes | The Dripping Pan, BN7 2XA | Fixture list, admission prices: adult £15, concession £11, owner discount, U16 free with adult, Ticket Tailor link. | Fixture-link lead + public event-platform adapter. |
| Potters Bar Town | Lantern Stadium, EN6 1DP | Pitchero fixtures, admission prices: adult £13, concession £10, New Generation £5, U16 £1. | Stable HTML, manual purchase-link fallback. |
| Ramsgate | WW Martin Community Stadium / Southwood Stadium, CT11 0AN | Official ticket office with Fanbase links, named fixtures, adult/concession criteria; match posts expose all-ticket/no-gate and sale end dates. | Public Fanbase adapter + ticket-office scrape. |
| St Albans City | Clarence Park, AL1 4PL or AL1 4NF conflict | Prices: men adult £18, concession £12.50, Next Gen £9, youth £6, junior £1; Ktckts categories. | Public Ktckts adapter + price/news scrape. |
| Welling United | Park View Road, DA16 1SY | Fixtures, adult £15, concession/student/blue light/armed forces £10, U18 £6, U11 free, no online sales unless advertised. | Stable HTML pay-on-gate lead. |
| Whitehawk | The Enclosed Ground, postcode needs venue seed | Fixtures, admission prices: adult £13/£12 advance, OAP/student/NHS £8/£7 advance, U18 £5/£4, U13 free. Ktckts shop. | Public Ktckts adapter + stable HTML. |
| Wingate & Finchley | Maurice Rebak Stadium, N12 0PD | Fixture table, adult £14 gate/£13 online, concession £9/£8, 10-16 £5, U10 free, cash/card, advance online closes day before. | Stable HTML + fixture-link lead. |

## Adapter Patterns

High-priority shared adapters:

- `fanbasePublicEventAdapter`: Dulwich Hamlet, Brentwood, Chatham, Dartford, Folkestone, Ramsgate, Cray Valley PM, Cray Wanderers where officially linked.
- `ktcktsPublicEventAdapter`: Billericay Town, Cheshunt, St Albans City, Whitehawk.
- `pitcheroClubAdapter`: Aveley, Canvey Island, Cray Valley PM, Potters Bar Town.
- `clubWordPressNewsAdapter`: Cray Wanderers, Folkestone, Ramsgate, several clubs with matchday posts.
- `staticAdmissionPageAdapter`: most clubs.
- `ticketTailorPublicEventAdapter`: Lewes where official links resolve to public Ticket Tailor events.

Club-specific adapters should compose these shared platform parsers with club-level mapping rules, venue metadata, and price/concession precedence.

## DBA Issues

The DBA agent should define these rules before implementation:

- Price precedence: fixture/event page > current-season official price page > official matchday/news post > opponent away guide > manual seed.
- Season freshness: reject or mark stale prices when page title references an older season.
- Sale state: treat "tickets not currently available", "no products on sale", and missing purchase links as lead states, not sold-out states.
- Sold-out: only emit `sold_out` when explicit source text says sold out.
- Advance/gate split: model online advance and matchday gate prices separately when both exist.
- Conditional child pricing: represent U13/U16 free with paying adult as conditional eligibility, not unconditional free availability.
- Venue postcodes: seed missing/conflicting postcodes for Chichester City, Whitehawk, and St Albans City after DBA review.
- Opponent previews: allow as fallback only with lower source priority than official club pages.

## Implementation Recommendations

1. Implement `TicketOpportunityLead` and source provenance before club adapters.
2. Build shared platform parsers for Fanbase, Ktckts/Kaizen, Pitchero, and static admission pages.
3. Implement first club adapters in this order:
   - Dulwich Hamlet
   - Chatham Town
   - Brentwood Town
   - Cheshunt
   - Cray Valley PM
   - Folkestone Invicta
   - Welling United
   - Wingate & Finchley
4. Add lower-confidence/manual-follow-up clubs after the shared patterns are stable:
   - Hashtag United
   - Canvey Island
   - Carshalton Athletic
   - Chichester City postcode enrichment
   - Whitehawk postcode enrichment
   - St Albans postcode normalization

## Sources

- League team list: `https://dulwichhamletfc.co.uk/mens-team-news/25-26-isthmian-league-teams-confirmed`
- Dulwich Hamlet spec: `docs/research/dulwich-hamlet-ingestion-spec.md`
- Representative club sources:
  - `https://www.pitchero.com/clubs/aveley/a/admission-fees-202526-season-41065.html`
  - `https://www.billericaytownfc.co.uk/tickets/`
  - `https://www.brentwoodtownfc.co.uk/club-news/2025-26-ticketing-announcement`
  - `https://bhtfc.co.uk/club/admission-prices/`
  - `https://www.canveyislandfc.com/a/admission-prices-52456.html`
  - `https://www.carshaltonathletic.co.uk/mens-1st-team/tickets/`
  - `https://www.chathamtownfc.com/tickets/`
  - `https://cheshuntfc.com/tickets/`
  - `https://chichestercityfc.co.uk/admission-prices/`
  - `https://www.crayvalleypmfc.com/a/admission-prices-202526-including-season-tickets-57000.html`
  - `https://www.cray-wanderers.com/product-category/tickets/`
  - `https://dartfordfc.com/matchday/ticket-prices/`
  - `https://folkestoneinvictafc.co.uk/2025/04/season-ticket-admission-prices-2025-26/`
  - `https://hashtagunited.co.uk/`
  - `https://lewesfc.com/matches/mens-1st-team/fixtures/`
  - `https://www.pitchero.com/clubs/pottersbartownfc/a/admission-prices-53133.html`
  - `https://ramsgatefc.co.uk/ticket-office/`
  - `https://www.stalbanscityfc.com/2025-26-match-day-and-season-ticket-prices/`
  - `https://wellingunited.com/tickets/admission-prices/`
  - `https://whitehawkfc.com/admission-costs/`
  - `https://www.wingatefinchley.com/first-team-match-tickets`
