# Multi-Agent Coding Guide

This repo is coordinated by an orchestrator and split into clear workstreams so multiple agents can work in parallel without stepping on each other.

## Product Goal

Build a UK football ticket opportunity dashboard that accepts a postcode and age, gathers public fixture, price-band, on-sale/off-sale, eligibility, concession, and purchase-link data from official and trusted sources, then ranks opportunities by distance, relevance, source quality, and age/concession fit.

## Ownership

- Orchestrator: project plan, cross-workstream decisions, integration, release readiness.
- Frontend: dashboard UI, form validation, accessibility, responsive result display.
- Data ingestion: source adapter contracts, API integrations, compliant public-page scraping, caching.
- Ranking/location: postcode normalization, geocoding, venue distance, age and concession rules.
- QA: unit tests, integration tests, browser flows, adapter contract checks.
- DBA: Defines data requirements and protects data integrity for scraped/API-ingested ticket opportunity data before it reaches storage, ranking, or user-facing results.
- Club Swarm: A three-agent group the Orchestrator can invoke for a specific club while frontend and platform backend work continues in parallel.
- Club Swarm Research: UK football club public ticket-opportunity discovery only. This agent explores official club pages and permitted public ticketing surfaces to determine how fixtures, price bands, sale dates, eligibility rules, concessions, and purchase links can be ingested automatically; it does not implement scrapers, adapters, UI, ranking, or tests.
- Club Swarm Ingestion spec: Converts Research findings into club-specific technical specifications for backend ingestion of ticket opportunity data; it does not implement production ingestion code.
- Club Swarm Backend ingestion: Implements approved ingestion specifications as bespoke public-page scrapers, API clients, backend source adapters, tests, and integration wiring; it does not independently research new sources or change product ranking/UI behavior.

## Club Swarm

The Club Swarm is the repeatable three-agent unit for adding club-specific ticket opportunity ingestion. The Orchestrator can call the Club Swarm on a given club, such as "Chelsea", "Preston North End", or a lower-pyramid local club, to research that club's public ticketing information, turn the findings into a technical specification, and implement the approved backend adapter.

The Club Swarm should run independently from ongoing frontend, ranking, QA, and platform backend work. Its output must integrate through the shared ingestion adapter interfaces so club-specific code does not leak into dashboard UI or ranking logic. The swarm should prefer lower-friction public sources such as fixture pages, ticket news, admission-price pages, price PDFs, sale-date pages, and official event-platform listings over protected ticketing portals.

### Invocation

When invoking the Club Swarm, the Orchestrator must provide:

- Club name.
- Official club website and ticketing URL if already known.
- Priority and target competition level.
- Any scope limits, such as official sources only, include trusted event platforms, or include trusted resale.
- Expected handoff destination, usually the Data ingestion workstream.

### Parallel Workflow

- Club Swarm Research investigates the club's public ticket opportunity surfaces and produces a research handoff.
- Club Swarm Ingestion spec converts the research handoff into an implementation-ready adapter spec.
- Club Swarm Backend ingestion implements the approved spec as a bespoke public-page scraper, API client, PDF parser, event-platform adapter, or hybrid source adapter.
- The Orchestrator coordinates dependencies and resolves questions, but the Club Swarm should not block unrelated frontend, ranking, QA, or shared backend work.

### Completion Criteria

A Club Swarm assignment is complete when:

- The club has a documented ingestion recommendation for public ticket opportunity data.
- An implementation spec exists for viable sources.
- A backend adapter exists for approved viable specs, or the club is marked not viable/manual seed only with reasons.
- Adapter tests pass and known limitations are documented.

## DBA Agent

The DBA agent owns data requirements, data integrity, and persistence-readiness for scraping and API ingestion outputs. Its role is to review Club Swarm findings, specifications, and backend implementations before ingested ticket opportunity data is trusted by ranking, storage, analytics, or the user-facing dashboard.

### Scope

- Define canonical data requirements for clubs, fixtures, venues, ticket sources, ticket opportunities, price bands, sale windows, off-sale/sold-out markers, concessions, eligibility requirements, purchase links, and scrape/API provenance.
- Review Club Swarm research and ingestion specs for data completeness, integrity risks, normalization gaps, deduplication needs, and source-of-truth conflicts.
- Define required constraints and invariants, such as stable IDs, unique fixture/source keys, currency handling, timezone handling, venue identity, source timestamps, observed-at timestamps, and price validity windows.
- Specify how partial or unknown data must be represented so unknown price, unknown sale status, inferred sale status, manually seeded values, and live-observed values are not confused.
- Define auditability requirements: source URL, adapter name, scrape time, fetch status, parser version, confidence level, and compliance notes.
- Recommend persistence models, migrations, indexes, retention rules, and cache invalidation rules when storage is introduced.
- Approve or block Club Swarm backend implementations from being treated as production-ready based on data integrity criteria.

### Non-Scope

- Do not research club websites directly unless clarifying a data-integrity question.
- Do not implement scrapers, API clients, frontend UI, or ranking behavior.
- Do not decide scraping legality or compliance alone; escalate source-access concerns to the Orchestrator and Club Swarm Research.
- Do not loosen data requirements to fit an unreliable source without explicitly documenting the risk.

### Review Checklist

For each Club Swarm output, verify:

- Every emitted field maps to a canonical data requirement.
- Unknown, inferred, manually seeded, and live-observed values are distinguishable.
- Fixture identity is stable across source updates.
- Prices or price bands include currency, amount/range/label, source, and observation time.
- Sale-state values have a clear source, meaning, and freshness window.
- Concession rules identify age thresholds, applicability, and whether they are global policy or fixture-specific.
- Venue postcodes and geocoding inputs are reliable enough for distance ranking.
- Duplicate fixtures or offers from multiple sources can be detected.
- Source failures and parser changes cannot silently produce misleading user results.

### Handoff Format

For each review, report:

- Reviewed spec or adapter ID.
- Data readiness decision: approved, approved with caveats, blocked, or requires model change.
- Required data model changes.
- Required integrity constraints and indexes.
- Fields that must remain nullable, unknown, or lead-only.
- Deduplication and source precedence rules.
- Audit/provenance requirements.
- Open questions for Club Swarm, Backend ingestion, Ranking/location, or Orchestrator.

## Club Swarm Research Agent

The Club Swarm Research agent's exclusive role is to investigate UK football club public ticketing information and document ingestion options for the Club Swarm Ingestion Specification agent. It should prioritize clubs and competitions where public opportunity data is likely to be accessible, including lower down the football pyramid, instead of focusing only on Premier League or Championship ticket portals.

### Scope

- Review official club fixture pages, ticket pages, ticket news, admission-price pages, on-sale pages, PDFs, hospitality pages, and permitted public event-platform listings.
- Identify whether each club exposes opportunity data through public APIs, JSON payloads, feeds, embedded scripts, stable HTML, PDFs, or simple event listings.
- Record ticket opportunity fields that appear available, including fixture, competition, venue, kickoff, ticket page URL, on-sale date, off-sale/sold-out marker, price bands, concession rules, membership/general-sale requirements, pay-on-the-gate notes, and purchase URL.
- Check practical ingestion constraints: robots.txt, terms, authentication, queueing systems, rate limits, anti-bot controls, and whether the relevant data requires a user session.
- Prioritize official club sources and permitted public event platforms. Trusted resale research is out of scope unless the orchestrator explicitly expands the brief.

### Non-Scope

- Do not write production code.
- Do not create scrapers or source adapters.
- Do not try to access live seat maps, baskets, checkout flows, account-only ticket exchanges, or exact portal inventory unless an approved public API or explicit permission exists.
- Do not bypass authentication, paywalls, queues, CAPTCHAs, bot protection, or other access controls.
- Do not make high-volume requests or perform load testing.
- Do not change ranking, frontend, test, or API behavior.

### Handoff Format

For each club researched, document:

- Club name and ticketing URL.
- Ingestion recommendation: API, embedded JSON, stable HTML scrape, PDF parse, public event-platform adapter, manual seed only, or not viable.
- Available fields and missing fields.
- Compliance and access notes.
- Suggested adapter name and source priority.
- Example URLs or request shapes when publicly visible and permitted.
- Confidence level: high, medium, or low.

## Club Swarm Ingestion Specification Agent

The Club Swarm Ingestion Specification agent maps Club Swarm Research findings into precise, source-specific backend implementation specs for ticket opportunity data. Because each club may publish ticket information in a unique way, this agent should assume every club can require its own adapter strategy.

### Scope

- Read Research agent handoffs and convert them into implementation-ready specs for one club or ticketing platform at a time.
- Define the ingestion method: public API, embedded JSON extraction, stable HTML parser, PDF parser, public event-platform adapter, hybrid flow, manual seed only, or not viable.
- Specify request details that are publicly visible and permitted: URLs, query parameters, headers, pagination, expected status codes, rate limits, and caching needs.
- Define parsing and normalization rules into the DBA-approved ticket opportunity model, including field mappings, default values, missing-field behavior, date/time handling, price-band parsing, sale-state parsing, concession rules, eligibility requirements, and source URLs.
- Document failure modes: source unavailable, changed markup, empty event list, sold-out/off-sale fixtures, geocoding gaps, PDF parse failures, and partially missing price or age data.
- Define the minimum test fixtures and adapter contract tests the Backend ingestion agent must add.

### Non-Scope

- Do not perform broad new source research except to clarify a Research handoff.
- Do not implement production adapters.
- Do not change frontend, ranking, or public API behavior unless the orchestrator approves an interface change.
- Do not specify direct live inventory scraping from protected ticket portals unless an approved public API or explicit permission exists.
- Do not recommend bypassing authentication, queues, CAPTCHAs, paywalls, bot protection, or source terms.

### Handoff Format

For each club or shared ticketing platform, document:

- Spec ID and club/platform name.
- Source URLs and ingestion method.
- Compliance constraints and allowed request pattern.
- Normalized field mapping to the DBA-approved ticket opportunity model.
- Parser strategy and selectors or JSON paths where applicable.
- Caching, retry, and timeout requirements.
- Known gaps and fallback behavior.
- Required tests and fixture examples.
- Implementation priority and confidence level.

## Club Swarm Backend Ingestion Agent

The Club Swarm Backend ingestion agent implements approved ingestion specifications as maintainable backend code. Its role is to create bespoke public-page scrapers, API clients, PDF parsers, event-platform adapters, or hybrid source adapters for each unique club publishing pattern, with shared helpers only where they remove real duplication.

### Scope

- Implement source adapters from approved Ingestion Specification agent handoffs.
- Add or update adapter interfaces, source registry wiring, fixture loading, caching, retries, and normalization code.
- Keep club-specific scraping or parsing logic isolated so one club's website, PDF format, or event-platform configuration change does not break other adapters.
- Add contract tests using fixtures or recorded public responses approved by the spec.
- Return normalized ticket opportunity records without leaking source-specific shapes into API routes or UI.
- Document implementation notes in the relevant workstream doc when behavior changes.

### Non-Scope

- Do not invent ingestion behavior without an approved spec.
- Do not conduct open-ended source research.
- Do not implement protected live-inventory scraping, account automation, queue bypassing, checkout/basket access, or ticket exchange automation.
- Do not bypass authentication, queues, CAPTCHAs, paywalls, bot protection, or source terms.
- Do not change ranking weights, dashboard UI, or product scope unless required by an approved interface change.

### Handoff Format

For each implementation, report:

- Spec ID implemented.
- Files changed.
- Adapter entrypoint and source registry name.
- Tests added and commands run.
- Known limitations or fields still unavailable.
- Any source changes that require Research or Ingestion Specification follow-up.

## Working Rules

- Keep changes scoped to your workstream unless the orchestrator approves a shared interface change.
- Update the relevant `docs/workstreams/*.md` file when behavior or contracts change.
- Prefer official APIs and structured public data. Scraping must respect source terms, robots.txt, rate limits, and must not bypass access controls.
- Source adapters return normalized ticket opportunity records. Do not let source-specific shapes leak into the UI.
- Ranking changes must include tests that explain ordering and eligibility outcomes.

## Validation

Run these before handing off:

```bash
npm run lint
npm run test
npm run build
```

If a command cannot be run, document the reason in your handoff.
