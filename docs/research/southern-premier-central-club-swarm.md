# Southern League Premier Central Club Swarm Research

Research date: 2026-05-09.

Scope: Step 3 Southern League Premier Central public ticket opportunity data. This excludes protected live inventory, account-only ticketing, baskets, checkout, queues, CAPTCHAs, seat maps, and automated purchasing.

## Summary

Southern Premier Central is a very strong fit for ticket opportunity ingestion. Public sources commonly expose fixtures, prices, venue postcodes, concession rules, online/gate splits, and purchase links.

Best first candidates:

- Banbury United
- Bury Town
- Needham Market
- Real Bedford
- Redditch United
- Royston Town
- Stourbridge
- Halesowen Town
- Kettering Town
- Worcester City

Lower-confidence/manual candidates:

- Quorn
- St Ives Town for price bands
- Alvechurch due stale price page
- Stamford / Stratford for per-fixture purchase links

## Club Findings

| Club | Venue / postcode | Public opportunity fields | Recommendation |
| --- | --- | --- | --- |
| AFC Sudbury | Brundon Lane, CO10 7HN | Matchday info: adult £14, concession 65+ £11, U18 £1; turnstile-only. | Stable HTML + pay-on-gate lead. |
| Alvechurch | Lye Meadow, B48 7RS | 2024-25 prices, Ktckts, gate card/cash; price freshness issue. | Ktckts adapter + stable fallback. |
| Banbury United | Spencer Stadium, OX16 5AB | 2025-26 pricing news; Ktckts products; member and segregated-match pricing. | Public Ktckts adapter. |
| Barwell | Kirkby Road, LE9 8FQ | Pitchero admission: adult £12, concession £8, U16 £4, U11 free. | Stable HTML + pay-on-gate lead. |
| Bishop's Stortford | Woodside Park, CM23 5RG | Ticket info: adult £15, 60+ £10, 12-17 £8, U12 free. | Stable HTML + manual purchase method. |
| Bromsgrove Sporting | Victoria Ground, B61 0DR | Ticket page: adult £12, concession £9, disabled £8, youth £5, U12 free; Fanbase link. | Fanbase adapter + stable fallback. |
| Bury Town | Ram Meadow, IP33 1XP | Ticket prices and fixture purchase links; Ktckts; adult £12, concession £8, 10-16 £4, U10 free. | Ktckts adapter + fixture lead. |
| Halesowen Town | The Grove, B63 3TB | Admission page; TicketCo for selected all-ticket/high-demand games; sale windows and sold-out markers in news. | Stable HTML + TicketCo/news adapter. |
| Harborough Town | The Beehive, LE16 9HF | Ticket news pages, all-ticket/segregated rules, physical sale notes; prices vary by season/fixture. | Official ticket-news scrape. |
| Kettering Town | Latimer Park, NN15 5PS | Ticket info; Fanbase; all-ticket/no-day-payment/priority sale notes in news. | Fanbase + official news adapter. |
| Leiston | The Flannery Stadium, IP16 4DQ | Pitchero admission: adult £13, concession £10, student £8, U16 £3, U5 free; previews. | Pitchero/admission + preview scrape. |
| Needham Market | Bloomfields, IP6 8DA | Ktckts events with from-prices and not-on-sale markers; adult £15, over-60 £10, 12-16 £5. | Ktckts + official news adapter. |
| Quorn | Farley Way, LE12 8RB | Season ticket prices only; no clear matchday admission or online match-ticket surface. | Fixture-link lead + manual seed. |
| Real Bedford | Ledger Stadium, MK44 3LW / MK44 3SB conflict | Ticket Tailor events, fixtures with buy links, adult £10 advance/£12 day, concession £6/£8, U18 free/£2. | Ticket Tailor + official fixtures/news adapter. |
| Redditch United | Valley Stadium, B97 4AU | Official prices: adult £12 gate/£11 online, concession £9/£8, 14-17/student £5; FIXR public events. | FIXR + official HTML adapter. |
| Royston Town | Garden Walk, SG8 7HP | Ktckts events and admission: adult £14 gate/£12 online, concession £9/£8, U16 £4/£3; sale cutoffs. | Ktckts + admissions adapter. |
| Spalding United | Sir Halley Stewart Field, PE11 1DA | Pitchero admission: adult £14, concession £9, U16 £5, U5 free; special events may use TicketCo/Ticket Tailor. | Pitchero + fixture-link/news adapter. |
| St Ives Town | Westwood Road, PE27 6DT | Ktckts match list from £2; admissions page stale. | Ktckts lead + manual price verification. |
| Stamford AFC | Borderville / Zeeco Stadium, PE9 1US | Pitchero admission: adult £13, concession £9, 12-17 £5, U11 free. | Stable Pitchero + fixture lead. |
| Stourbridge | War Memorial Athletic Ground, DY8 4HN | Ktckts events, online/matchday price split, age rules, sale instructions. | Ktckts + admissions adapter. |
| Stratford Town | Knights Lane, CV37 7BZ | Ticket info: adult £12, concession £8, 12-17 £5, U12 free; parking £3. | Stable HTML + fixture lead. |
| Worcester City | Sixways, WR3 8ZE | Admission: adult £14, concession £9.50, 12-17 £5, U12 £3; Flicket ticket office; hospitality from £45. | Flicket lead + Pitchero/admission adapter. |

## Shared Adapter Patterns

- `ktcktsPublicEventAdapter`: Alvechurch, Banbury, Bury Town, Needham Market, Royston Town, St Ives Town, Stourbridge.
- `fanbasePublicEventAdapter`: Bromsgrove Sporting, Kettering Town.
- `ticketTailorPublicEventAdapter`: Real Bedford and occasional special events.
- `ticketCoPublicEventAdapter`: Halesowen Town and occasional special events.
- `fixrPublicEventAdapter`: Redditch United.
- `flicketPublicTicketOfficeAdapter`: Worcester City.
- `pitcheroClubAdapter`: Barwell, Leiston, Spalding, Stamford, Worcester and others.
- `clubNewsTicketInfoAdapter`: Halesowen, Harborough, Kettering, Real Bedford, Worcester.

## DBA Issues

- Resolve venue postcode conflict for Real Bedford.
- Resolve current-season price freshness for Alvechurch and St Ives.
- Model member pricing for Banbury separately from public gate/online pricing.
- Treat segregated/all-ticket fixture rules as fixture-specific overrides.
- Track physical clubhouse-sale-only fixtures for Harborough as manual/lead-only.
- Keep `not_on_sale`, `no_products`, and `unavailable` as sale-state leads, not sold-out.
- Model online vs gate price splits across Redditch, Royston, Stourbridge, Real Bedford, and others.

## Implementation Recommendations

1. Build Ktckts/Kaizen first; it covers the largest number of SPC clubs.
2. Build Ticket Tailor and FIXR adapters next because Real Bedford and Redditch are high-quality public sources.
3. Add Fanbase, TicketCo, and Flicket as narrower platform adapters.
4. Add Pitchero/static admission parsing for pay-on-gate clubs.
5. Implement first SPC club adapters for Banbury, Bury Town, Needham Market, Real Bedford, Redditch, Royston, and Stourbridge.

## Representative Sources

- `https://www.afcsudbury.co.uk/a/matchday-information-69201.html`
- `https://banburyunitedfc.ktckts.com/`
- `https://www.burytownfc.co.uk/sipg/1024`
- `https://ht-fc.co.uk/admission-prices/`
- `https://www.ketteringtownfc.com/tickets/`
- `https://needhammarketfc.ktckts.com/brand/match-tickets`
- `https://www.realbedford.com/buy-tickets`
- `https://redditchunited.co.uk/tickets/`
- `https://roystontownfc.ktckts.com/brand/match-tickets`
- `https://stourbridgefc.ktckts.com/`
- `https://wcfc.flicket.io/`
