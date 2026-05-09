# Northern Premier League Premier Division Club Swarm Research

Research date: 2026-05-09.

Scope: Step 3 Northern Premier League Premier Division public ticket opportunity data. This excludes protected live inventory, account-only ticketing, baskets, checkout, queues, CAPTCHAs, seat maps, and automated purchasing.

## Summary

The Northern Premier League Premier Division is a strong fit for ticket opportunity ingestion. Most clubs publish enough public data for useful leads:

- Pitchero fixture/admission pages are common.
- Ktckts/Kaizen and Fanbase recur as public event platforms.
- Several clubs publish advance and gate pricing separately.
- Many clubs support pay-on-gate and online advance purchase.
- Sale-state signals are coarse and must be modeled as lead state, not live inventory.

Best first candidates:

- Ashton United
- FC United of Manchester
- Gainsborough Trinity
- Hebburn Town
- Hednesford Town
- Lancaster City
- Rushall Olympic
- Stockton Town
- Warrington Town
- Whitby Town

Lower-confidence/manual candidates:

- Bamber Bridge
- Cleethorpes Town
- Ilkeston Town
- Morpeth Town
- Stocksbridge Park Steels
- Workington AFC

## Club Findings

| Club | Venue / postcode | Public opportunity fields | Recommendation |
| --- | --- | --- | --- |
| Ashton United | Hurst Cross, OL6 8DY | Pitchero fixtures/admission; adult £14, concession £10, 12-15 £8, U12 £1; cash/card gate; Ktckts sale markers. | Stable HTML + Ktckts adapter. |
| Bamber Bridge | Irongate / SFC Stadium, PR5 6UU | Official site moved; reliable prices from away guides: adult £12, concession £8, U15 £2, U11 free. | Fixture-link lead + manual admission seed. |
| Cleethorpes Town | The Linden Club, DN32 8QL | Sparse official site; away guides agree on adult £12, concession £8, U16 £4, U6 free. | Manual admission seed + fixture-link lead. |
| FC United of Manchester | Broadhurst Park, M40 0FJ | Official ticket page: adult £15, concession £10.50, 18-21 £5, U18 £3, U5 free; Fanbase advance tickets. | Stable HTML + Fanbase adapter. |
| Gainsborough Trinity | The Northolme / Kal Group Stadium, DN21 2QW | Fixtures, adult £13, concession £9, U16 £4, U5 free; Ktckts match tickets. | Stable HTML + Ktckts adapter. |
| Guiseley | Nethermoor Park, LS20 8BT | Home games page: adult £13, concession £9, 11-18 £5, U11 £1; pay gate unless specified. | Stable HTML scrape. |
| Hebburn Town | South Drive, NE31 1UN | Pitchero fixtures, ground page, previews with adult £10, concession £8, U16 £2, U12 free; Fanbase. | Pitchero fixtures + Fanbase adapter. |
| Hednesford Town | Keys Park, postcode needs seed | Fixtures, Fanbase links, adult £13, concession £10, 10-16 £5, U10 free; no turnstile payment. | Public Fanbase adapter + stable HTML lead. |
| Hyde United | Ewen Fields, SK14 5PL / SK14 2SB conflict | Fixtures, prices: terrace adult £12, concession £8, U16 £6, U12 £2; seated upgrade; gate-first. | Stable HTML + fixture-link lead. |
| Ilkeston Town | New Manor Ground, DE7 8JF | Fixture/news pages; current price page not found; older official price article adult £12, concession £8, U16 free. | Manual seed + fixture scrape. |
| Lancaster City | Giant Axe, LA1 5PE | Pitchero fixtures/admission: adult £12, concession £9, student £5, youth £3, U12 free; Fanbase for some fixtures. | Stable HTML + Fanbase adapter. |
| Leek Town | Harrison Park, ST13 8LD | Pitchero pages, Fanbase partner, gate for normal fixtures, all-ticket/sold-out exceptions in news. | Fanbase adapter + stable HTML/news scrape. |
| Morpeth Town | Craik Park, NE61 2YX | Official fixtures; prices from trusted away guides: adult £12, concession £8, U16 £4, U5 free. | Fixture scrape + manual price seed. |
| Prescot Cables | Auto Safety Centre Stadium, L34 6HB | Pitchero context, Ktckts match/season areas, fixture-specific prices vary. | Public Ktckts adapter + Pitchero scrape. |
| Rushall Olympic | Dales Lane, WS4 1LJ | Official admission and online tickets; adult £14/£13.50 online, concession £10/£9.50, youth/U12 bands; Ktckts. | Stable HTML + Ktckts adapter. |
| Stocksbridge Park Steels | Bracken Moor, S36 2AN | Fixtures, price graphic: adult £12, concession £8, U16 £5, U5 free; SumUp store weak. | Stable HTML + image/OCR fallback. |
| Stockton Town | MAP Group UK Stadium, TS19 0QD | Official admission: adult £13, concession £10, 11-18 £6, U11 £4; Ktckts events show from £4. | Ktckts adapter + admission scrape. |
| Warrington Rylands | Gorsey Lane, WA2 7RZ | Tickets page: adult £12, concession £9, U16 £4; Fanbase fixtures; all-ticket cases in news. | Stable HTML + Fanbase adapter. |
| Warrington Town | Cantilever Park, WA4 2RS | Ticket platform event cards; online adult £13, concession £9, U16 £3, gate adult £15, concession £10. | Public event-platform adapter + price scrape. |
| Whitby Town | Towbar Express Stadium, YO21 3HZ | Admission news: adult £13, concession £9, U18 £5; Ktckts; fixture-specific U16 promos. | Stable HTML news + Ktckts adapter. |
| Workington AFC | Borough Park, CA14 2DT | Ktckts match-tickets area currently no products; current price page not found. | Ktckts fixture-link lead + manual price seed. |

## Shared Adapter Patterns

- `ktcktsPublicEventAdapter`: Ashton United, Gainsborough Trinity, Rushall Olympic, Stockton Town, Whitby Town, Workington, Prescot Cables.
- `fanbasePublicEventAdapter`: FC United, Hebburn Town, Hednesford Town, Lancaster City, Leek Town, Warrington Rylands.
- `pitcheroClubAdapter`: Ashton, Hebburn, Lancaster, Leek, Prescot, Stocksbridge, and other Pitchero clubs.
- `staticAdmissionPageAdapter`: most clubs.
- `clubNewsMatchdayAdapter`: Hyde, Leek, Whitby, Hebburn, Lancaster, Prescot.

## DBA Issues

- Model online advance and gate prices separately.
- Treat Ktckts/Fanbase "no products on sale", "currently unavailable", and missing products as sale-state leads, not sold-out unless explicit.
- Resolve postcode conflicts for Hyde United.
- Seed missing postcode for Hednesford Town from an authoritative source before distance ranking.
- Mark old price pages as stale for Ilkeston, Workington, and any source older than the current season.
- Handle concession threshold conflicts, especially Hednesford 60+ vs 65+.
- Allow fixture-specific price overrides for Leek, Prescot, Whitby, and cup/all-ticket fixtures.

## Implementation Recommendations

1. Add `TicketOpportunityLead` and source provenance.
2. Implement shared Ktckts, Fanbase, Pitchero, static admission, and matchday-news parsers.
3. Build first NPL adapters for Stockton Town, Warrington Town, Ashton United, Gainsborough Trinity, Lancaster City, and Whitby Town.
4. Add Hednesford, Rushall, FC United, Hebburn, and Warrington Rylands after Fanbase/Ktckts handling is stable.
5. Keep Bamber Bridge, Cleethorpes, Ilkeston, Morpeth, Stocksbridge, and Workington as lower-priority manual/lead-only until fresher official price pages are found.

## Representative Sources

- `https://www.ashtonunited.org/a/admission-21841.html`
- `https://fc-utd.co.uk/seasontickets`
- `https://www.gainsboroughtrinity.com/club/about`
- `https://guiseleyafc.co.uk/home-games/`
- `https://hebburntownfc.com/ground`
- `https://htfc.co.uk/matchday-info/`
- `https://hydeunited.co.uk/gate-and-season-ticket-prices-for-2025-26-season/`
- `https://www.pitchero.com/clubs/lancastercity/a/admission-prices-202526-20883.html?page=2`
- `https://stocktontownfc.com/first-team/season-ticket-matchday-admission-season-2025-26-2/`
- `https://warringtontownfc.co.uk/tickets`
- `https://www.whitbytownfc.com/news/whitby-town-announces-202526-season-ticket-information-2919009.html`
