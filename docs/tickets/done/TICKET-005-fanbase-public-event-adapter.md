# TICKET-005: Build Fanbase Public Event Adapter Pattern

Status: done
Owner role: Backend ingestion
Priority: P1
Depends on: TICKET-002

## Goal

Create a reusable adapter for officially linked public Fanbase event pages.

## Scope

- In scope:
  - Read public Fanbase event pages linked from official club pages.
  - Extract fixture ID, fixture name, date/time, venue, public price labels, public sale-state text, and purchase URL.
  - Fail closed on login, queue, CAPTCHA, bot-check, checkout, basket, quantity, or account flows.
- Out of scope:
  - Submitting forms.
  - Inventory probing.
  - Account-only ticket exchange.

## Acceptance Criteria

- Adapter only fetches explicitly supplied/officially linked Fanbase URLs.
- Blocked or login-required pages produce diagnostics and no misleading leads.
- Sale-state output distinguishes unavailable/no-products from sold out.

## Implementation Notes

- Useful examples: Dulwich Hamlet, Chatham Town, Brentwood Town, Dorchester Town, Gloucester City.

## Resolution

- Added `fanbasePublicEventAdapter`, `parseFanbasePublicEventHtml`, and `runFanbasePublicEventUrl` in `lib/ingestion/fanbase-public-event.ts`.
- Adapter accepts only explicitly supplied public event URLs and rejects protected checkout/account-style URLs through compliance guards.
- Parser extracts visible event title, price labels, sale-state text, and purchase URL without probing inventory.
- Added tests for public event parsing and checkout URL rejection.

## Tests

- Public event fixture test.
- unavailable/no-products test.
- blocked/login diagnostic test.
- checkout URL rejection test.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
