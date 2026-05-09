# TICKET-006: Build Ktckts/Kaizen Public Event Adapter Pattern

Status: done
Owner role: Backend ingestion
Priority: P1
Depends on: TICKET-002

## Goal

Create a reusable adapter for public Ktckts/Kaizen event and brand pages.

## Scope

- In scope:
  - Parse public match-ticket brand pages.
  - Parse public event pages.
  - Extract event title, fixture, kickoff, venue, from-price, category prices, sale-state markers, and purchase URL.
- Out of scope:
  - Login-required products.
  - Checkout and basket flows.
  - Private APIs unless separately approved.

## Acceptance Criteria

- Adapter handles public events, no-products pages, and not-on-sale states.
- Adapter records platform URL and observed timestamp.
- Adapter supports club-level mapping rules for venue/price precedence.

## Implementation Notes

- Useful examples: Bracknell Town, Banbury United, Needham Market, Stockton Town, Billericay Town.

## Resolution

- Added `ktcktsPublicEventAdapter` and parser helpers in `lib/ingestion/ktckts-public-event.ts`.
- Parses public Ktckts/Kaizen brand pages from JSON-LD item lists or visible event links.
- Parses event JSON-LD for title, venue, competition, offer URL, from-price, sale-state markers, and provenance.
- Maps no-products, restricted, unavailable, and discontinued states without treating them as sold out.
- Added tests for brand discovery, event price/venue extraction, no-products empty success, and unavailable-not-sold-out behavior.

## Tests

- Brand page event discovery test.
- Event price extraction test.
- no-products/not-on-sale test.
- stale/static fallback interaction test.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
