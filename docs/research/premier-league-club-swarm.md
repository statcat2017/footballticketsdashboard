# Premier League Club Swarm Research

Research date: 2026-05-09.

Scope: first-pass Club Swarm research across the 2025-26 Premier League clubs. This is discovery only. Do not treat any ticketing portal as crawlable unless a later spec explicitly proves it is permitted and stable.

## Summary

Most Premier League clubs expose useful public ticketing pages, but very few expose live ticket inventory or exact live pricing through unauthenticated, clearly permitted surfaces. The dominant safe pattern is to ingest official club pages for fixture leads, sale windows, ticket status labels, policy, pricing tables, and outbound purchase links, while avoiding login-gated ticketing portals, queues, seat maps, baskets, exchanges, and account flows.

Best first implementation candidates:

- Liverpool: public ticket availability/detail pages expose fixture status and sale text.
- Manchester City: public tickets page exposes fixture cards and status labels.
- Tottenham Hotspur: public home tickets pages expose fixture cards, category, membership availability, and CTAs.
- Chelsea: official ticket-news articles expose sale windows, eligibility, price categories, and exchange status.
- Arsenal: public tickets page exposes fixture cards and broad sale/status labels.
- Brentford: public ticket guide exposes pricing, age bands, eligibility, and policy.
- Wolverhampton Wanderers: public home tickets page exposes upcoming home tickets and sale labels.
- Nottingham Forest: public ticket hub exposes ticket news, availability lead, membership rules, category/pricing guide entry points.

Common blocker: current backend `TicketResult` requires concrete `pricePence` and `availability`. Many viable club sources produce official fixture leads rather than complete live ticket results. The DBA recommendation should be to add a lead model before implementing most adapters.

## Club Findings

| Club | Official ticketing surface | Public ingestion surface | Recommendation |
| --- | --- | --- | --- |
| Arsenal | `arsenal.com/tickets`, `eticketing.co.uk/arsenal` | Public fixture cards with opponent, date, kickoff, venue, status, info/hospitality links. eTicketing purchase/exchange flow is not suitable for automation. | Fixture-link lead only from Arsenal public pages. |
| Aston Villa | `tickets.avfc.co.uk`, `avfc.co.uk/category/tickets` | Public club page is mostly navigation/loading shell; ticket portal appears protected and disallowed. | Manual seed only unless fixture-specific public ticket news is found. |
| AFC Bournemouth | `afcb.co.uk/tickets`, `tickets.afcb.co.uk` | Public landing page exposes high-level ticket categories, not structured fixture inventory. | Manual seed only or fixture-link lead if public ticket news pages are identified. |
| Brentford | `eticketing.co.uk/brentfordfc`, Brentford public guides | Public guide pages expose categories, prices, age bands, TAP eligibility, exchange rules, and priorities. | Stable HTML for policy/pricing, plus fixture-link leads. |
| Brighton & Hove Albion | `tickets.brightonandhovealbion.com`, club buy-tickets page | Public club page is mainly a link shell; portal appears protected and has disallowed event paths. | Manual seed only unless separate public ticket news pages expose fixture info. |
| Burnley | `burnleyfootballclub.com/more/more-tickets`, likely `eticketing.co.uk/burnleyfc` | Public hub links memberships, waiting list, loyalty points, and ticket information; no live fixture inventory. | Fixture-link lead only. |
| Chelsea | `chelseafc.com/en/tickets/mens-tickets`, `ticketing.chelseafc.com` | Official news pages expose fixture sale details, sale phases, membership requirements, price category, ticket exchange status, forwarding rules, loyalty points. | Stable HTML/article scrape for fixture leads and sale metadata. |
| Crystal Palace | `cpfc.co.uk/tickets`, `eticketing.co.uk/cpfc` | Public hub and embedded page data expose links, resale policy, stadium map/prices, on-sale dates; portal is login-oriented. | Fixture-link lead only, with optional hub/policy parsing. |
| Everton | `evertonfc.com/tickets`, `eticketing.evertonfc.com` | Official hub exposes Buy Tickets, Ticket Availability, On Sale Dates, Ticket Pricing, Membership; no clean live inventory found. | Fixture-link lead only; later inspect stable ticket-news/on-sale pages. |
| Fulham | `fulhamfc.com/tickets-and-hospitality`, eTicketing link | Public Nuxt page exposes ticket/hospitality cards and links; no fixture-level live availability found. | Fixture-link lead only. |
| Leeds United | `tickets.leedsunited.com`, Leeds ticketing FAQ/news | Public ticketing news and FAQ expose sale phases, eligibility, concession definitions, and policy. Portal is disallowed. | Fixture-link lead only from public CMS/news pages. |
| Liverpool | `liverpoolfc.com/tickets/tickets-availability`, ticketing subdomains | Public availability/detail pages expose fixture, opponent, kickoff, venue, sale notices, eligibility, and availability labels. Ticketing subdomains are disallowed. | Stable HTML for availability/detail pages; lead links only into ticketing. |
| Manchester City | `mancity.com/tickets`, `tickets.mancity.com` | Public ticket page exposes fixture cards, date/time, venue, opponent, CTA, and status labels. Ticketing subdomain is disallowed. | Stable HTML from `mancity.com/tickets`; no portal crawling. |
| Manchester United | `manutd.com/tickets-and-hospitality`, `tickets.manutd.com` | Public page gives release policy, membership requirement, ballots, app/NFC rules; no fixture-level availability list found. | Manual seed only or generic fixture-link lead unless official feed appears. |
| Newcastle United | `newcastleunited.com/en/tickets`, `book.newcastleunited.com` | Public pages expose membership requirements, on-sale date text, venue/postcode, hospitality, and exchange behavior. Booking domain is disallowed. | Fixture-link lead only. |
| Nottingham Forest | `nottinghamforest.co.uk/tickets` | Public ticket hub exposes ticket availability CTA, latest ticket news, 2025-26 home ticket process, membership access, Ticket Exchange policy. | Stable HTML/fixture-link lead for hub/news/policy; no live inventory without approved access. |
| Sunderland | `safc.com/tickets`, `tickets.safc.com` | Public ticket hub exposes ticket categories and purchase channels; help pages expose account, resale, age verification, and eTicketing process. | Fixture-link lead only; parse help/policy pages for age/account constraints. |
| Tottenham Hotspur | `tottenhamhotspur.com/tickets/buy-tickets/home-tickets` | Public home ticket pages expose fixture cards, opponent, category, date/time, competition, venue, One Hotspur/Non-member/Premium CTAs, and membership/exchange policy. | Stable HTML for public home tickets; avoid account purchase and exchange flows. |
| West Ham United | `whufc.com/tickets`, `eticketing.co.uk/whufc` | Public pages expose how-to-buy, prices link, booking fee, home-sale timing, Claret Member priority, exchange policy, ticket office info. | Fixture-link lead and policy/pricing scrape; no live inventory from eTicketing. |
| Wolverhampton Wanderers | `wolves.co.uk/tickets-hospitality/home-match-tickets` | Public home tickets page exposes upcoming home match tickets, opponent, venue, competition, member/general sale labels, hospitality links. Fan charter exposes categories and sale windows. | Stable HTML for home ticket cards and policy/pricing; no seat/inventory crawling. |

## Access And Compliance Pattern

- Avoid ticketing subdomains and eTicketing portals unless a later spec proves they are crawlable and permitted.
- Do not automate login, account, membership, queue, exchange, seat map, basket, app/NFC, or checkout flows.
- Do not bypass Queue-it, DataDome, CAPTCHA, bot detection, JavaScript challenges, or robots restrictions.
- Public club CMS pages, public ticket-news pages, public ticket availability pages, and public policy/pricing pages are the primary safe surfaces.
- Treat ticket portal links as outbound purchase URLs, not ingestion URLs.

## DBA Notes

The DBA agent should define data requirements before implementation:

- Add `TicketLead` or an equivalent discriminated result for partial official leads.
- Distinguish `unknown`, `manual seed`, `policy-derived`, and `live observed` values.
- Require source URL, adapter ID, observed-at timestamp, parser version, confidence, and compliance notes on every ingested record.
- Keep ranking limited to complete ticket offers until product explicitly supports lead ranking.
- Track sale/status labels separately from true live availability.

## Recommended Implementation Order

1. Add shared ingestion contract and DBA-approved lead model.
2. Implement stable public HTML adapters for Liverpool, Manchester City, Tottenham, Chelsea, Wolves, Arsenal, Brentford, and Nottingham Forest.
3. Implement lead-only/policy adapters for West Ham, Leeds, Newcastle, Crystal Palace, Everton, Fulham, Burnley, Sunderland.
4. Keep Aston Villa, Bournemouth, Brighton, Manchester United as manual seed or low-priority lead-only until richer public pages are identified.

## Sources

Current Premier League club list checked against current 2025-26 standings and club listings from ESPN, Premier League, and Premier League shop pages.

Representative source links:

- Arsenal: `https://www.arsenal.com/tickets`
- Aston Villa: `https://www.avfc.co.uk/category/tickets/`
- AFC Bournemouth: `https://www.afcb.co.uk/tickets/`
- Brentford: `https://www.brentfordfc.com/en/news/article/club-news-buying-tickets-brentford-premier-league-2025-26`
- Brighton: `https://www.brightonandhovealbion.com/tickets/buy-tickets`
- Burnley: `https://burnleyfootballclub.com/more/more-tickets`
- Chelsea: `https://www.chelseafc.com/en/tickets/mens-tickets`
- Crystal Palace: `https://www.cpfc.co.uk/tickets/`
- Everton: `https://www.evertonfc.com/tickets/`
- Fulham: `https://www.fulhamfc.com/tickets-and-hospitality/`
- Leeds: `https://www.leedsunited.com/en/ticketing-faq`
- Liverpool: `https://www.liverpoolfc.com/tickets/tickets-availability`
- Manchester City: `https://www.mancity.com/tickets`
- Manchester United: `https://www.manutd.com/tickets-and-hospitality/`
- Newcastle: `https://www.newcastleunited.com/en/tickets`
- Nottingham Forest: `https://www.nottinghamforest.co.uk/tickets/`
- Sunderland: `https://www.safc.com/tickets`
- Tottenham: `https://www.tottenhamhotspur.com/tickets/buy-tickets/home-tickets/`
- West Ham: `https://www.whufc.com/tickets/how-buy`
- Wolves: `https://www.wolves.co.uk/tickets-hospitality/home-match-tickets/`
