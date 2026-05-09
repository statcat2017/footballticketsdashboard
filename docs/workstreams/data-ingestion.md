# Data Ingestion Workstream

## Ownership

- Source adapter interfaces.
- Public ticket opportunity ingestion.
- Official APIs and structured public ticket pages.
- Public event-platform adapters.
- Caching, retries, source errors, compliance notes, and provenance.

## Source Policy

- Prefer official club sources and permitted public event-platform pages.
- Scrape only when permitted by source terms and robots.txt.
- Do not bypass authentication, paywalls, queues, CAPTCHAs, bot checks, seat maps, baskets, checkout, account flows, or ticket exchanges.
- Cache source responses to reduce source load and improve dashboard latency.
- Adapters must fail closed when a source is blocked, disallowed, login-required, or structurally unparseable.

## Canonical Output

All public opportunity adapters must target `TicketOpportunityLead`, documented in `docs/data-model/ticket-opportunity-lead.md`.

Do not emit ranked `TicketResult` records directly from public opportunity sources. `TicketResult` remains separate for any future source that can provide confirmed ticket offers with permitted price and availability data.

## Evidence And Unknown Values

- Unknown scalar values stay `null`.
- Unknown enum values use `unknown` only when the source was checked and did not provide the value.
- Do not invent kickoff times, prices, postcodes, off-sale times, sale states, or concession thresholds.
- Every emitted lead must include adapter ID, parser version, source URL, observed/fetched timestamps, confidence, fetch status, and compliance notes.
- Manual seed values must be clearly marked as manual and lower confidence unless explicitly refreshed.

## Sale State Is Not Inventory

Sale state describes a public opportunity lead, not live seat inventory.

- `available_lead`: public buy/info route exists or explicit public text says tickets are available.
- `pay_on_gate`: source states gate or ticket-office purchase is possible.
- `not_on_sale_yet`: source explicitly says future sale.
- `off_sale`: source explicitly says off sale or public sale has closed.
- `sold_out`: source explicitly says sold out.
- `no_public_sale`: source says no public sale or restricted sale only.
- `cancelled_or_postponed`: fixture is not currently playable as scheduled.
- `unknown`: no reliable sale-state text was found.

Missing links, no-products pages, unavailable pages, or request failures must not be converted into `sold_out` unless the source explicitly says sold out.

## Price Bands And Precedence

Represent prices as `PriceBand[]`, not a single required price.

Each price band must include audience, channel, currency, amount or range, basis, source URL, observed time, conditional flag, and precedence rank.

Price precedence, highest first:

1. Fixture/event page.
2. Official current price page.
3. Official fixture/news post.
4. Trusted opponent guide.
5. Manual seed.

Fixture-specific cup, all-ticket, segregated, or special-event pricing overrides static club admission policy for that fixture only. Lower-precedence values should retain provenance when useful.

## Venue And Postcode Integrity

- Fixture source venue text wins over club default for neutral and away fixtures.
- Approved venue registry data wins for coordinates.
- Conflicting postcodes must be marked with `postcodeStatus: "conflict"`.
- Distance ranking must be disabled or heavily downgraded for conflicted or unknown postcodes.
- Do not silently choose between plausible venue postcode conflicts.

## Adapter Contract Requirements

Adapters must:

- return `TicketOpportunityLead[]` plus diagnostics;
- include source provenance on every emitted lead;
- distinguish successful empty results from fetch/parser failures;
- avoid protected flows and emit diagnostics when blocked;
- include contract tests with recorded or synthetic fixtures;
- keep source-specific raw shapes out of API routes and UI components.

The shared implementation lives in `lib/ingestion`.

- `ticket-opportunity.ts`: DBA-approved `TicketOpportunityLead` and supporting types.
- `adapter-contract.ts`: `TicketSourceAdapter`, adapter result, diagnostic, context, and outcome helper types.
- `registry.ts`: source adapter registry with duplicate adapter ID protection.
- `compliance.ts`: public HTTP(S) and protected-flow guard helpers.
- `static-admission.ts`: reusable parser for labelled GBP admission pages, concession rules, pay-on-gate text, season labels, and official ticket links.
- `fanbase-public-event.ts`: conservative parser for explicitly supplied public Fanbase event pages; rejects protected checkout/account flows.
- `ktckts-public-event.ts`: HTML/JSON-LD parser for public Ktckts/Kaizen brand and event pages, including no-products and restricted/unavailable states.
- `pitchero-club.ts`: public Pitchero fixture/admission/match-centre parser for club pages and custom Pitchero domains.
- `dulwich-hamlet.ts`: first club adapter using official Dulwich Hamlet fixture pages and static ticket-prices page.

Opportunity adapters must implement `TicketSourceAdapter.run(context)` and return `TicketSourceAdapterResult`. That result shape only accepts `TicketOpportunityLead[]`, so public opportunity sources cannot directly emit ranked `TicketResult` records.

Use the shared result helpers for common outcomes:

- `createAdapterResult`: successful leads plus optional diagnostics.
- `createEmptyAdapterResult`: successful fetch with no public events/opportunities.
- `createBlockedAdapterResult`: compliance, robots, login, or protected-flow rejection with no placeholder leads.
- `createParserFailureResult`: parser error converted to a diagnostic with no placeholder leads.

## Next Work

- Harden official news fallback parsing for clubs where fixture pages are empty but ticket/news posts exist.
- Promote shared Pitchero and Ktckts/Kaizen parsers into first club-specific adapters.
- Build Ticket Tailor, FIXR, TicketCo, Upfan, Flicket, Shopify, and WeGotTickets platform adapters as narrower follow-ups.
