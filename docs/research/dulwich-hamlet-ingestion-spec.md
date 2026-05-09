# Dulwich Hamlet FC Ingestion Specification

## Spec ID

`DHFC-OFFICIAL-OPPORTUNITY-LEADS-001`

Adapter name: `dulwichHamletOfficialOpportunityAdapter`.

Scope: ticket opportunity and fixture lead ingestion only. This spec does not authorize live inventory scraping, checkout automation, account access, basket creation, quantity submission, seat-map probing, or ranking/UI changes.

## Source URLs And Ingestion Method

Primary official sources:

- Club site: `https://dulwichhamletfc.co.uk/`
- Ticket hub: `https://dulwichhamletfc.co.uk/tickets`
- Men's fixtures: `https://dulwichhamletfc.co.uk/fixtures/mens-fixtures-and-tickets?view=fixtures`
- Women's fixtures: `https://dulwichhamletfc.co.uk/fixtures/womens-fixtures-and-tickets?view=fixtures`
- Ticket prices: `https://dulwichhamletfc.co.uk/fixtures/ticket-prices`
- Season tickets: `https://dulwichhamletfc.co.uk/club-info/matchday/season-tickets`

Enrichment sources:

- Officially linked Fanbase public event pages, when linked from Dulwich Hamlet fixture or ticket pages.
- Officially linked INTIX or TicketSource public pages only when linked from an official Dulwich Hamlet page.
- Official Dulwich Hamlet ticket/news posts reachable from the ticket hub or fixture cards.

Ingestion method:

- Stable official HTML scrape for fixture cards/lists and static price/concession pages.
- Optional Fanbase public event-page enrichment for event IDs, ticket category labels, public prices, fees, and public sale/status text.
- News-post fallback for per-fixture sale notes when fixture cards link to official news/ticket announcements.
- No protected portal or live inventory ingestion.

## Compliance Constraints And Allowed Request Pattern

Allowed:

- Fetch official Dulwich Hamlet public pages listed above at low frequency.
- Follow only same-site official links and official outbound event links visible on the fetched public pages.
- Fetch public Fanbase/INTIX/TicketSource event pages only when the URL is explicitly linked from an official Dulwich Hamlet page and is accessible without login, CAPTCHA, queue bypass, basket state, or account cookies.
- Parse static public content, embedded public JSON, and visible HTML text.
- Store outbound purchase URLs as leads without simulating a purchaser journey.

Disallowed:

- Do not access checkout, basket, account, payment, quantity-selection, or authenticated endpoints.
- Do not submit forms, reserve tickets, query seat maps, or probe inventory counts.
- Do not bypass robots.txt, terms, queues, bot protection, CAPTCHAs, paywalls, or login requirements.
- Do not infer live availability from request failures, hidden controls, JavaScript app state, or missing buttons.
- Do not emit complete `TicketResult` records with fake `pricePence` or concrete `availability` to satisfy the current repo model.

Request pattern:

- Use a clear adapter user agent configured by the platform.
- Maximum one request per source URL per scheduled ingest run unless following a visible public fixture/news/event link.
- Cap one Dulwich Hamlet ingest run to 20 fetched pages, including enrichment links.
- Do not crawl the broader site recursively.
- Stop enrichment for a linked ticket platform immediately on 401, 403, 429, CAPTCHA, queue/waiting-room, bot-check, login-required, or robots-disallowed responses.

## Normalized Field Mapping

Target model: DBA-approved ticket opportunity/lead model, not the current concrete `TicketResult`.

Recommended normalized shape:

```ts
interface TicketOpportunityLead {
  id: string;
  adapterId: "dulwichHamletOfficialOpportunityAdapter";
  parserVersion: string;
  sourceKind: "official";
  sourcePriority: "primary" | "enrichment" | "fallback";
  sourceUrl: string;
  purchaseUrl?: string;
  observedAt: string;
  fetchedAt: string;
  confidence: "high" | "medium" | "low";
  complianceNotes: string[];

  club: {
    name: "Dulwich Hamlet FC";
    team: "men" | "women" | "unknown";
  };
  fixture: {
    stableKey: string;
    homeTeam?: string;
    awayTeam?: string;
    opponent?: string;
    competition?: string;
    kickoffAt?: string;
    kickoffTimezone: "Europe/London";
    venueName?: string;
    venueAddress?: string;
    venuePostcode?: string;
    homeAway?: "home" | "away" | "neutral" | "unknown";
  };
  sale: {
    status: "available_lead" | "pay_on_gate" | "sold_out" | "off_sale" | "not_on_sale_yet" | "unknown";
    statusBasis: "explicit_source_text" | "static_policy" | "inferred_from_link_presence" | "unknown";
    onSaleAt?: string;
    offSaleAt?: string;
    freshnessUntil?: string;
  };
  prices: Array<{
    label: string;
    currency: "GBP";
    amountPence?: number;
    minAmountPence?: number;
    maxAmountPence?: number;
    feePence?: number;
    appliesTo: "men" | "women" | "fixture_specific" | "unknown";
    priceBasis: "static_policy" | "event_page" | "news_post";
    sourceUrl: string;
    observedAt: string;
  }>;
  concessions: Array<{
    label: string;
    minAge?: number;
    maxAge?: number;
    qualifyingGroups?: string[];
    requiresId: boolean;
    appliesTo: "men" | "women" | "global_policy" | "fixture_specific" | "unknown";
    sourceUrl: string;
  }>;
  eligibility: Array<{
    label: string;
    requirementType: "general_sale" | "membership" | "id_required" | "age" | "unknown";
    sourceUrl: string;
  }>;
}
```

Field mapping rules:

- `club.name`: constant `Dulwich Hamlet FC`.
- `club.team`: derive from the source fixture page path: men's fixtures => `men`, women's fixtures => `women`; otherwise `unknown`.
- `fixture.opponent`, `competition`, `kickoffAt`, `venueName`, and `purchaseUrl`: parse from official fixture cards/lists.
- `fixture.venueName`: use card venue text when present. For Dulwich Hamlet home fixtures, normalize to `Champion Hill Stadium`.
- `fixture.venueAddress`: for normalized home fixtures, `Edgar Kail Way, East Dulwich, London`.
- `fixture.venuePostcode`: for normalized home fixtures, `SE22 8BD`. Leave nullable for away fixtures unless explicitly present on the source page or an approved venue registry supplies it.
- `fixture.homeAway`: derive from fixture venue/home-away labels where visible. If venue is Champion Hill Stadium or ticket page describes home admission, set `home`; otherwise `unknown` unless source explicitly says away.
- `fixture.stableKey`: deterministic slug from `club`, `team`, normalized opponent, normalized competition, kickoff date, and home/away marker. Include source event ID when Fanbase exposes a stable public `fixtureId`.
- `sale.status`: use explicit public text first. Map "sold out" to `sold_out`, "off sale" or equivalent to `off_sale`, future sale text to `not_on_sale_yet`, visible buy-ticket link to `available_lead`, and pay-on-gate policy to `pay_on_gate` only when no stronger fixture-specific sale state is present. Otherwise `unknown`.
- `sale.statusBasis`: never mark link presence as explicit availability; use `inferred_from_link_presence` for visible CTAs without sale text.
- `prices`: parse static prices from the ticket prices page:
  - Men's adult: `1300` pence.
  - Men's concessions: `550` pence.
  - Men's U13: `0` pence with paying adult note in eligibility/concession text.
  - Women's adult: `500` pence.
  - Women's concessions: `250` pence.
  - Women's U13: `0` pence with paying adult note.
- `prices.priceBasis`: `static_policy` for the official prices page, `event_page` for Fanbase/INTIX/TicketSource public event pages, and `news_post` for official news/ticket posts.
- `concessions`: map official policy to structured rules:
  - Seniors: `minAge: 65`.
  - Teenagers: `minAge: 13`, `maxAge: 19`.
  - U13: `maxAge: 12`, with paying adult requirement captured in `eligibility`.
  - Qualifying groups: unemployed/JSA, NHS, blue light, armed forces, local authority, full-time students.
  - `requiresId: true` for all concession categories unless a fixture-specific source explicitly says otherwise.
- `eligibility`: represent general sale/pay-on-gate as lead terms. Represent "valid ID required" and "free U13 with paying adult" as requirements, not prices alone.
- `purchaseUrl`: official fixture ticket link or official linked public event page. Preserve but do not crawl beyond the allowed public event page.
- `confidence`: high for official fixture and static price fields, medium for Fanbase enrichment, low for any inferred sale state.

Current repo compatibility:

- The current `TicketResult` requires concrete `pricePence` and `availability`.
- This adapter must wait for the DBA-approved opportunity/lead model before production ingestion.
- If implemented before the model change, it may only produce internal fixture lead records behind a feature flag or test-only contract, not ranked dashboard results.

## Parser Strategy And Extraction Approach

Official fixture pages:

- Fetch men's and women's fixture URLs independently.
- Prefer semantic fixture card/list boundaries, such as repeated fixture rows/cards containing date, opponent, competition, venue, and CTA/link elements.
- Extract month headings and combine them with per-fixture day/date text when fixture cards omit the month.
- Parse visible kickoff text using `Europe/London`, preserving unknown kickoff as nullable rather than inventing a time.
- Extract competition and opponent from labeled text where available; otherwise use card text heuristics bounded to the fixture card.
- Extract venue and home/away labels from visible venue/location fields.
- Extract ticket links from anchor text and CTAs containing terms such as `ticket`, `buy`, `book`, `fanbase`, `admission`, or `match tickets`.
- Normalize relative links against `https://dulwichhamletfc.co.uk/`.

Ticket prices page:

- Parse visible price tables or price sections.
- Identify men's and women's sections by headings.
- Extract price labels and GBP amounts with a currency-aware parser.
- Preserve policy notes as eligibility/concession text rather than dropping them.

Season tickets page:

- Parse only as context for ticketing policy and purchase links when the ticket hub links to it.
- Do not map season-ticket products into fixture opportunities unless a future spec explicitly adds season-ticket lead support.

Official news fallback:

- From the ticket hub or fixture CTAs, follow official Dulwich Hamlet news/ticket posts.
- Extract fixture-specific sale state, sale date, off-sale date, pay-on-gate notes, and price exceptions only when explicitly visible.
- Treat article publication date as provenance, not as sale date unless the text explicitly states it.

Fanbase and other official event-link enrichment:

- Fetch only the linked public event page.
- Parse public embedded JSON or visible event text for event ID, opponent, date/time, category labels, prices, fees, public status text, and purchase URL.
- Do not call private API endpoints discovered from JavaScript bundles unless Research or Orchestrator approves the endpoint as public and permitted.
- Do not submit event forms or add query parameters for quantities, basket, checkout, or seat selection.
- Reconcile enriched event data to the official fixture by public event ID when available; otherwise by kickoff date, opponent, and team.

Selectors:

- Backend ingestion should record concrete selectors during implementation from recorded fixtures. Tests must fail when fixture boundaries cannot be found.
- Do not rely on brittle global text regexes across the whole page except as a fallback after fixture cards are isolated.

## Caching, Retry, And Timeout

- Fixture pages: cache for 6 hours.
- Ticket prices and season-ticket policy pages: cache for 7 days.
- Official news/ticket posts: cache for 12 hours while upcoming, 7 days after fixture kickoff.
- Public event platform enrichment pages: cache for 2 hours before fixture kickoff; cache for 7 days after kickoff for audit/replay.
- Timeout: 8 seconds per request.
- Retry: one retry with backoff for network errors, connection resets, and 5xx responses.
- No retry for 400, 401, 403, 404, 410, 429, CAPTCHA, queue/waiting-room, bot-check, login-required, or robots-disallowed responses.
- Record fetch status, HTTP status, final URL after redirects, and parser version on every emitted opportunity or adapter diagnostic.
- A failed enrichment fetch must not drop the official fixture lead if the official fixture page parsed successfully.

## Known Gaps And Fallback Behavior

- Implementation note, 2026-05-09: the live official men's and women's fixture pages currently return an explicit `No fixtures found` state. The adapter treats this as a successful empty ingest and does not invent fixture opportunities from the static prices page.
- Implementation note, 2026-05-09: the official ticket-prices page remains parseable and currently exposes 2025-26 prices, Fanbase fixture/dashboard links, pay-on-turnstiles text, and concession rules.
- Exact on-sale and off-sale windows are inconsistent. Leave `onSaleAt` and `offSaleAt` nullable unless explicitly public.
- Public sale state is not the same as live inventory. Do not convert `available_lead` into current availability.
- Sold-out/off-sale should be emitted only when explicit public source text says so.
- Fanbase data is medium-confidence enrichment and may change independently of official fixture markup.
- Per-fixture price exceptions may not appear on the static prices page. Fixture-specific event/news prices should override static policy prices for that fixture only, with both sources retained in provenance.
- Away fixture venue postcodes are often missing. Keep away postcode nullable unless source provides it or a separate approved venue registry enriches it.
- U13 free pricing depends on a paying adult. Represent it as a conditional concession/eligibility requirement, not an unconditional standalone ticket result.
- Pay-on-gate is a useful lead but not proof of unlimited admission. Represent as `pay_on_gate` with `static_policy` or explicit fixture source basis.
- If official fixture markup changes, fail closed with adapter diagnostics instead of emitting partial misleading fixture data.
- If no fixture cards are present and the page explicitly indicates no fixtures, emit an empty success result.

## Required Tests And Fixture Examples

Contract tests:

- Emits `TicketOpportunityLead[]` and never emits ranked `TicketResult` records for Dulwich Hamlet under the current concrete result model.
- Includes adapter ID, parser version, observed/fetched timestamps, source URL, confidence, and compliance notes on every lead.
- Does not fetch checkout, basket, account, quantity, seat-map, payment, or login URLs.
- Stops enrichment on 401, 403, 429, CAPTCHA, queue, or login-required responses while preserving official fixture leads.
- Uses `Europe/London` for kickoff parsing across GMT and BST dates.

Fixture parsing tests:

- Parses a men's home fixture from the official fixtures page into club/team, opponent, competition, kickoff, Champion Hill venue, `SE22 8BD`, official ticket URL, and stable key.
- Parses a women's home fixture and applies women's static price bands.
- Parses an away fixture without inventing a postcode.
- Combines month headings with per-card dates when needed.
- Treats a page with an explicit no-fixtures state as an empty successful ingest.

Price/concession tests:

- Parses men's adult `GBP 13.00`, concession `GBP 5.50`, and U13 free with paying adult condition.
- Parses women's adult `GBP 5.00`, concession `GBP 2.50`, and U13 free with paying adult condition.
- Maps senior concession to age 65+.
- Maps teenager concession to ages 13-19.
- Captures qualifying concession groups and valid ID requirement.

Sale-state tests:

- Maps explicit sold-out text to `sold_out`.
- Maps explicit off-sale text to `off_sale`.
- Maps visible ticket CTA without explicit availability text to `available_lead` with `inferred_from_link_presence`.
- Maps static or explicit pay-on-gate text to `pay_on_gate` without treating it as live availability.

Enrichment fixture examples:

- Recorded official men's fixtures HTML with at least one ticket CTA.
- Recorded official women's fixtures HTML with at least one ticket CTA.
- Recorded ticket prices HTML with men's and women's sections.
- Recorded official news/ticket post with fixture-specific sale notes, if available.
- Recorded public Fanbase event page linked from the official site, if available and permitted.
- Synthetic blocked Fanbase/login/queue responses proving enrichment fails closed.

## Implementation Priority And Confidence

Priority: high after the DBA-approved opportunity/lead model lands. Dulwich Hamlet is a strong lower-friction source for the dashboard because official fixture and static price/concession data are publicly available and map cleanly to ticket opportunity leads.

Confidence:

- Official fixture and static price ingestion: high.
- Official news fallback: medium.
- Fanbase public event enrichment: medium.
- Live availability or inventory: low and out of scope.

Production readiness condition:

- Block production ranking integration until the shared ingestion contract supports nullable/unknown prices, lead sale states, source provenance, and non-live opportunity records distinct from concrete ranked `TicketResult` values.
