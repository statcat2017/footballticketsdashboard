# Ranking And Location Workstream

## Ownership

- Postcode normalization.
- User and venue geocoding.
- Distance calculation.
- Age and concession matching.
- Ticket opportunity ranking and explanation.

## Current Behavior

- The legacy prototype ranking for seed `TicketResult` records remains available for tests and fallback development.
- The dashboard API ranks `TicketOpportunityLead` records through `RankedTicketOpportunityResult`.
- Postcodes are normalized to UK outward/inward format.
- Seed postcode coordinates power the first iteration.
- Lead ranking uses sale state, distance, price bands, confidence, and source quality.

## Target Ranking Model

Ranking will move from confirmed ticket results to public `TicketOpportunityLead` records. The model is documented in `docs/data-model/ticket-opportunity-lead.md`.

Ranking must not imply live inventory. A highly ranked `available_lead` means the opportunity is relevant and has useful public purchase/info data; it does not mean seats remain.

## Lead Eligibility For Ranking

A lead can be ranked when:

- fixture date is known or the lead has an explicit current sale/news context;
- venue postcode is `verified`, `source_provided`, or `registry_seed`;
- sale state is not `cancelled_or_postponed`;
- source confidence is not low unless the result is clearly marked low confidence;
- stale values are either refreshed or visibly downgraded.

Leads with `postcodeStatus: "conflict"` must not receive normal distance ranking.

## Effective Price Selection

The ranking layer chooses an effective display price from `PriceBand[]`; it does not mutate the source bands.

Use the DBA price precedence:

1. Fixture/event page.
2. Official current price page.
3. Official fixture/news post.
4. Trusted opponent guide.
5. Manual seed.

Within the highest applicable source, prefer the best age/concession match for the user. Preserve online vs gate distinctions in the UI and ranking explanation.

## Age And Concession Matching

Age matching uses explicit `ConcessionRule` and `EligibilityRule` records.

- Match senior, youth, child, and student/other concession groups only when source rules support it.
- Conditional free child prices, such as U13 free with paying adult, must remain conditional.
- ID-required concessions should be shown as eligible-with-ID rather than unconditional.
- If no concession rule matches, rank using adult/general price bands when available.

## Sale-State Ranking Semantics

Sale states affect ranking, but do not equal inventory.

Suggested priority:

1. `pay_on_gate` with fresh source and clear price.
2. `available_lead` with fresh official purchase/info link.
3. `not_on_sale_yet` with known on-sale date.
4. `unknown` with good fixture/price data.
5. `off_sale` or `no_public_sale`, shown only when useful for context.
6. `sold_out`, ranked low unless the user asks to see unavailable opportunities.
7. `cancelled_or_postponed`, excluded by default.

`sold_out` requires explicit source text. Missing products, missing links, or no-products pages are not enough.

## Freshness And Confidence Weighting

- Fresh official club/platform data ranks above stale or manual data.
- Stale static policy may still inform price expectations, but should be visibly downgraded.
- Manual seeds rank below current official sources.
- Inferred sale states rank below explicit source text.
- Low-confidence venue or price data should reduce ranking and add a warning reason.

## Distance Rules

- Use venue postcode/coordinates only when the venue reference is trusted enough.
- For home fixtures, approved venue registry coordinates can enrich missing source coordinates.
- For neutral and away fixtures, source venue text wins over club default.
- If postcode conflicts exist, disable or heavily downgrade distance ranking and surface the warning.

## Next Work

- Replace seed postcode coordinates with a geocoder or venue registry.
- Expand age/concession matching against explicit `ConcessionRule` records.
- Add ranking tests for not-on-sale, stale price, and postcode conflict cases.
