# TICKET-042: Source-Agnostic Fixture Ingestion Adapters

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-036, TICKET-038, TICKET-039

## Purpose

Implement the source adapter layer that lets API feeds, agentic web scrapes, URL table scrapes, CSV uploads, and CSV paste feed the same import batch pipeline.

## Work

- Define a normalized fixture import row contract shared by all adapters.
- Document the adapter boundary: source-specific parsers produce `NormalizedFixtureRow[]`, create batches with the shared batch helpers, and rely on validation/apply for resolution and fixture identity.
- Build adapter interfaces for:
  - API feed imports
  - agentic scrape output
  - static URL table scrape
  - CSV upload
  - CSV paste
- Implement CSV parsing as a fallback/manual adapter.
- Implement per-batch column mapping when source headers do not match expected fields.
- Implement static URL table scrape with strict fetch safety:
  - HTTP(S) only
  - reject localhost/private network targets
  - response size cap
  - timeout cap
  - no JavaScript execution
  - static HTML table parsing only
- Implement agentic scrape input as structured rows with evidence, confidence, source URL, and raw extraction metadata.
- Ensure scrape failures create import review items after TICKET-044 is available, or record failed batch state before then.
- Avoid fixture identity SQL in adapters. Existing fixture matching belongs in `findImportFixtureMatch()` and is reached through validation/apply so all sources make consistent insert/update decisions.

## Acceptance Criteria

- Every adapter writes to the same import batch and row model.
- New adapters can follow `docs/import-adapter-guide.md` without reimplementing club, competition, venue, duplicate, or fixture identity logic.
- CSV is not required as an intermediate format for API or agent imports.
- Static table scrape failure does not block manual paste/upload fallback.
- Agentic scrape rows can carry evidence and confidence for later validation and auto-approval decisions.
- Unsafe scrape URLs are rejected before fetch.

## Verification

- Adapter contract tests.
- CSV parser and column mapping tests.
- Safe URL validation tests.
- Static table extraction tests with local fixture HTML strings.
- Agentic structured-row ingestion tests.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
