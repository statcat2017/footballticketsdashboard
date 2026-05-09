# Southern League Premier South Club Swarm Research

Research date: 2026-05-09.

Scope: Step 3 Southern League Premier South public ticket opportunity data. This excludes protected live inventory, account-only ticketing, baskets, checkout, queues, CAPTCHAs, seat maps, and automated purchasing.

## Summary

Southern Premier South is another strong fit for ticket opportunity ingestion. Many clubs expose public prices, venue postcodes, online/gate split pricing, and public ticket platform links.

Best first candidates:

- Bracknell Town
- Dorchester Town
- Havant & Waterlooville
- Hanwell Town
- Poole Town
- Taunton Town
- Weymouth
- Wimborne Town
- Real platform candidates from this division: Fanbase, Ktckts, TicketCo, FIXR, Upfan, Shopify shop products, WeGotTickets.

Lower-confidence/manual candidates:

- Chertsey Town
- Plymouth Parkway for canonical prices
- Sholing due image-only price page
- Uxbridge direct Fanbase link discovery

## Club Findings

| Club | Venue / postcode | Public opportunity fields | Recommendation |
| --- | --- | --- | --- |
| Basingstoke Town | Winklebury Football Complex, RG23 8BF | Fanbase fixture rows, off-sale marker, match centre; fixture-observed prices from public away info. | Fanbase adapter + official news lead. |
| Berkhamsted | Glencar Community Stadium, HP4 2AL | Pitchero admission: adult £12, senior £6, U18 bands, cashless; Fanbase links via opponent pages. | Stable HTML + Fanbase fixture lead. |
| Bracknell Town | Bottom Meadow / SB Stadium, GU47 9BJ | Ktckts events with fixture, kickoff, prices, sale cutoff; online/gate split. | Ktckts adapter + official fallback. |
| Chertsey Town | Alwyns Lane, KT16 9DW | Sparse official fixture page; Fanbase links from opponent articles; prices from hosted examples. | Fanbase fixture lead + Southern League fallback. |
| Dorchester Town | Avenue Stadium, DT1 2RY | Strong ticket/admission page: adult/concession/student/youth online and turnstile prices; Fanbase; matchday news. | Official HTML + Fanbase adapter. |
| Evesham United | Spiers & Hartwell Stadium, WR11 2LZ | Official admission, 2026-27 prices already published, Upfan event rows. | Official HTML + Upfan adapter. |
| Farnham Town | Memorial Ground, GU9 7DY | Homepage baseline prices, Shopify ticket products, all-ticket/no-gate news. | Shopify ticket parser + fixture/news scrape. |
| Gloucester City | KMM Energy Stadium, GL2 5HD | Fixtures with Fanbase ticket links, public matchday guides, fixture-specific prices. | Fanbase adapter + fixture lead. |
| Gosport Borough | Privett Road, PO12 3SX | Pitchero ticket page: adult £14, concession/community £9, U16 £5, U12 free; Ktckts link. | Static admission + Ktckts lead. |
| Hanwell Town | Perivale Lane, UB6 8TL | Ticket page with next home game and prices; Fanbase; online/gate split; concessions. | Stable HTML + Fanbase lead. |
| Havant & Waterlooville | Westleigh Park, PO9 5TH | Admission page, TicketCo, fixture news, selected no-turnstile requirements. | TicketCo + admission/news adapter. |
| Hungerford Town | Bulpit Lane, RG17 0AY | Pitchero admission: adult £14, senior £10, 11-17 £5, U10 free; WeGotTickets link. | Stable HTML + Pitchero fixtures; WeGotTickets lead. |
| Plymouth Parkway | Bolitho Park, PL5 3JH | Fixture/event pages, Fanbase ticket centre, price bands from away info only. | Fixture HTML + Fanbase lead; manual price seed. |
| Poole Town | Tatnam Stadium, BH15 3JR | Ticket page with full 2025-26 online/turnstile prices and Fanbase; fixture endpoint empty but news list exists. | Static admission + Fanbase; fixture-news fallback. |
| Sholing | Portsmouth Road, SO19 9PW | Admission page image-only; match previews expose adult £15, concession £10, 13-19 £5, U12 free, cash/contactless. | Fixture/news scrape + image/OCR fallback. |
| Taunton Town | Wordsworth Drive, TA1 2HG | Admission page adult £14, concession £11, juniors £5, U6 free; Fanbase; pay turnstile. | Static admission + Fanbase lead. |
| Tiverton Town | Ladysmead, EX16 6SG | Ticket page with 2025-26 prices; Fanbase posts; cash/card gate. | Static HTML + Fanbase lead. |
| Uxbridge | Honeycroft, UB7 8HX | Admission page adult £8, concession £1, U16 free; Fanbase mentioned but direct link not exposed. | Static admission + manual Fanbase discovery. |
| Walton & Hersham | Elmbridge Xcel, KT12 2JP | Fixtures with ticket links; FIXR partner; 2026-27 prices published after promotion. | FIXR adapter + fixture HTML. |
| Weymouth | Bob Lucas Stadium, DT4 9XJ | Admission page, Fanbase link, adult £15, concession £12, youth £6, U16 free, carers free. | Static HTML + Fanbase lead. |
| Wimborne Town | Wyatt Homes Stadium, BH21 2FU | Full matchday prices, Fanbase link, cash/card ticket office. | Static HTML + Fanbase lead. |
| Yate Town | Lodge Road, BS37 7LE | Admission page: adult £12, concession £8, EFL ST £10, 12-18 £5, U12 £1; Fanbase nav. | Static HTML + Fanbase lead. |

## Shared Adapter Patterns

- `fanbasePublicEventAdapter`: Basingstoke, Berkhamsted, Chertsey, Dorchester, Gloucester, Hanwell, Plymouth Parkway, Poole, Taunton, Tiverton, Uxbridge, Weymouth, Wimborne, Yate.
- `ktcktsPublicEventAdapter`: Bracknell Town, Gosport Borough.
- `ticketCoPublicEventAdapter`: Havant & Waterlooville.
- `fixrPublicEventAdapter`: Walton & Hersham.
- `upfanPublicEventAdapter`: Evesham United.
- `shopifyTicketProductAdapter`: Farnham Town.
- `weGotTicketsPublicEventAdapter`: Hungerford Town lead-only unless event pages are enumerated.
- `clubNewsTicketInfoAdapter`: Basingstoke, Dorchester, Havant, Farnham, Poole, Sholing.

## DBA Issues

- Preserve season validity: Evesham and Walton & Hersham already expose 2026-27 pricing.
- Resolve venue/postcode and official source priority for Chertsey and Plymouth Parkway.
- Treat off-sale/no-products markers as lead states, not live inventory.
- Model online vs gate pricing for Bracknell, Dorchester, Hanwell, Poole, and others.
- Model all-ticket/no-gate exceptions from news posts as fixture-specific overrides.
- Track price source confidence when prices come from opponent away-ticket info rather than club-owned pages.
- Avoid image-only prices where possible; otherwise mark as OCR/manual confidence.

## Implementation Recommendations

1. Extend shared Fanbase handling; this division has broad Fanbase coverage.
2. Build Ktckts support for Bracknell/Gosport and reuse from other Step 3 reports.
3. Add TicketCo, FIXR, Upfan, Shopify, and WeGotTickets platform adapters as narrower modules.
4. Implement first SPS club adapters for Bracknell, Dorchester, Havant, Hanwell, Poole, Taunton, Weymouth, Wimborne, and Evesham.
5. Add Chertsey, Plymouth Parkway, Sholing, and Uxbridge after manual validation or richer public links are found.

## Representative Sources

- `https://btfc.co.uk/first-team/first-team-fixtures/`
- `https://www.pitchero.com/clubs/berkhamstedfootballclub/a/admission-prices-37771.html`
- `https://stadiumgu47.ktckts.com/brand/match-tickets`
- `https://www.dorchestertownfc.co.uk/tickets`
- `https://eveshamunitedfc.com/contact-admission/`
- `https://shop.ftfconline.com/pages/tickets`
- `https://www.gloucestercityafc.com/tickets`
- `https://hanwelltown.com/match-information/tickets/`
- `https://havantandwaterloovillefc.co.uk/tickets/admission-prices/`
- `https://pooletownfc.co.uk/matchday/ticket-information/`
- `https://tauntontown.com/admission-prices/`
- `https://uptheterras.co.uk/club-info/admission-prices/`
- `https://wimbornetownfc.co.uk/matchday/ticket-information/`
