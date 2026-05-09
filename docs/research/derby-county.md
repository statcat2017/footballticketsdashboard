# Derby County Club Swarm Handoff

## Summary

Club Swarm test target: Derby County FC.

Recommendation: do not implement a live Derby ticket scraper against the current backend contract. Derby's public pages can support fixture metadata and official outbound ticket links, but live ticket availability and pricing are not safely available from public crawlable sources.

## Research Findings

- Official ticketing URL: `https://tickets.dcfc.co.uk/`.
- Current home tickets page observation: Derby County's home tickets page can show `no events found`, which means there are no current home ticket fixtures listed. Treat this as a valid empty ticketing state, not a scraper failure.
- Public fixture metadata source: `https://mobile.dcfc.co.uk/fixtures`.
- Static ticketing information sources:
  - `https://www.dcfc.co.uk/page/ticketing-useful-information`
  - `https://www.dcfc.co.uk/page/accessible-ticketing-membership`
  - `https://www.dcfc.co.uk/page/accessibility-faqs`
- Example event URL shape: `https://tickets.dcfc.co.uk/en-GB/events/{fixture-name}/{yyyy-m-d_HH.mm}/{venue-slug}`.
- Derby describes the ticket office as presented by SeatGeek; the platform may use SeatGeek/SRO or Toptix-style infrastructure.

## Ingestion Recommendation

- Use Derby public fixture pages only for fixture metadata and official outbound ticket links.
- Treat `no events found` on Derby home ticket pages as a valid empty-state signal.
- Treat `tickets.dcfc.co.uk` as an outbound purchase destination only.
- Do not crawl `tickets.dcfc.co.uk` for availability, seat inventory, pricing, queue state, or event detail pages.
- Keep live price and availability as manual seed data unless Derby County or the platform provides approved API access or written permission.

Suggested future adapter name: `derbyCountyOfficialFixtureLinksAdapter`.

## Available Public Fields

- Fixture date and kickoff time.
- Competition.
- Home and away teams.
- Venue.
- Official ticket link when visible.
- Hospitality link when visible.
- Basic purchase channels.
- Booking fees and delivery options from static information pages.
- Static concession, accessibility, membership, and sale-policy notes.

## Missing Fields

- Live seat availability.
- Per-block inventory.
- Exact current ticket prices.
- Price bands by stand or block.
- Sale phase status per fixture.
- Event-specific member restrictions.
- Authenticated concession validation.
- Live queue status.

## Compliance And Access Notes

- Research found `tickets.dcfc.co.uk` protected by Queue-it, DataDome, JavaScript checks, and login/account requirements.
- Research found `tickets.dcfc.co.uk/robots.txt` disallows crawling.
- Do not bypass login, waiting rooms, CAPTCHAs, bot protection, JavaScript checks, or other access controls.
- Do not perform high-volume requests or seat-map probing.
- Public Derby pages should be fetched at low frequency and cached aggressively.

## Technical Spec

Spec ID: `DCFC-OFFICIAL-FIXTURE-LINKS-001`.

Allowed request pattern:

- Fetch `https://mobile.dcfc.co.uk/fixtures` at low frequency.
- Fetch static `dcfc.co.uk` ticketing information pages at low frequency.
- Never follow or fetch `tickets.dcfc.co.uk` event pages from the adapter.

Parser strategy:

- Parse public fixture cards or rows from the fixtures page.
- Extract fixture date, kickoff time, teams, competition, venue, and visible ticket or hospitality CTA URLs.
- Accept only official Derby domains for outbound links: `tickets.dcfc.co.uk`, `www.dcfc.co.uk`, and `dcfc.co.uk`.
- Ignore session-specific or tokenized links.

Caching and failure behavior:

- Cache fixture page responses for at least 6 hours.
- Cache static ticketing information pages for at least 7 days.
- Use an 8 second request timeout and at most one retry for network or 5xx failures.
- Do not retry 401, 403, 429, Queue-it redirects, DataDome responses, or robot-denied destinations.
- Fail closed and return no dynamic Derby results if public markup changes or access is blocked.
- Return a valid empty result set when Derby explicitly shows `no events found` for home tickets.

## Backend Blockers

- The repo does not yet have a `TicketSourceAdapter` interface or source registry.
- `TicketResult` currently requires `pricePence` and concrete `availability`.
- Derby's compliant public data cannot provide reliable live price or availability.
- Emitting fake/default price or availability would corrupt ranking.

## Recommended Backend Changes

Before implementing Derby or similar clubs, add:

- `TicketSourceAdapter`.
- Source registry.
- A partial lead model, such as `TicketLead`, distinct from complete ranked `TicketResult`.
- A discriminated ingestion result type, for example `complete-ticket` vs `fixture-lead`.
- Ranking guard so only complete `TicketResult` records are ranked.
- Adapter contract tests proving protected ticketing domains are not fetched.

## Required Tests For Future Adapter

- Normalizes a manually priced Derby home fixture into a valid `TicketResult`.
- Does not emit a complete `TicketResult` when price or availability is unknown.
- Emits or records a partial fixture lead once the ingestion contract supports it.
- Preserves official outbound ticket URLs without crawling them.
- Converts UK kickoff time to ISO correctly across BST and GMT dates.
- Rejects non-official ticket links.
- Confirms the adapter never requests `tickets.dcfc.co.uk` event pages.
- Treats `no events found` as a valid empty ticketing state, not an error.

## Confidence

Medium. Official source links and access constraints are clear, but protected ticket pages could not be inspected without entering out-of-scope Queue-it/login-protected flows.
