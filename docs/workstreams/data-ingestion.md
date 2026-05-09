# Data Ingestion Workstream

## Ownership

- Source adapter interfaces.
- Official APIs and structured official ticket pages.
- Trusted resale integrations.
- Caching, retries, source errors, and compliance notes.

## Source Policy

- Prefer official APIs and structured public data.
- Scrape only when permitted by source terms and robots.txt.
- Do not bypass authentication, paywalls, CAPTCHAs, or anti-bot controls.
- Cache source responses to reduce load and improve dashboard latency.

## Normalized Output

All adapters must return `TicketResult[]` with source, venue, kickoff, price, availability, URL, and age/concession metadata when available.

## Next Work

- Add a `TicketSourceAdapter` interface.
- Add a first official club adapter.
- Add adapter contract tests using recorded or seeded fixtures.
