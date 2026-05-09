# Multi-Agent Coding Guide

This repo is coordinated by an orchestrator and split into clear workstreams so multiple agents can work in parallel without stepping on each other.

## Product Goal

Build a UK football ticketing dashboard that accepts a postcode and age, gathers ticket availability from official and trusted sources, then ranks results by distance, eligibility, concession pricing, price, and source quality.

## Ownership

- Orchestrator: project plan, cross-workstream decisions, integration, release readiness.
- Frontend: dashboard UI, form validation, accessibility, responsive result display.
- Data ingestion: source adapter contracts, API integrations, compliant scraping, caching.
- Ranking/location: postcode normalization, geocoding, venue distance, age and concession rules.
- QA: unit tests, integration tests, browser flows, adapter contract checks.
- Research: Reads club websites and other sources to find APIs or web scraping routes to get accurate, up to date ticket information.

## Working Rules

- Keep changes scoped to your workstream unless the orchestrator approves a shared interface change.
- Update the relevant `docs/workstreams/*.md` file when behavior or contracts change.
- Prefer official APIs and structured public data. Scraping must respect source terms, robots.txt, rate limits, and must not bypass access controls.
- Source adapters return normalized `TicketResult` objects. Do not let source-specific shapes leak into the UI.
- Ranking changes must include tests that explain ordering and eligibility outcomes.

## Validation

Run these before handing off:

```bash
npm run lint
npm run test
npm run build
```

If a command cannot be run, document the reason in your handoff.
