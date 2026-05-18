# TICKET-036: Fixture Source Registry And Import Batch Model

Status: schema-complete
Owner: Backend
Priority: high
Depends on: TICKET-027

## Purpose

Create the source and batch primitives required for API, agentic scrape, table scrape, upload, and paste imports to share one ingestion workflow.

## What Is Done

- `fixture_sources` table with source type, trust level, auto-approval, evidence requirements, failure tracking.
- `import_batches` table with source link, adapter type, season, actor, raw payload, parse status, approval status, row counts.
- `import_batch_rows` table with normalized rows, match outcomes, warnings, evidence, final action, fixture reference.
- Full indexes and FKs for source/batch/row lookups.
- Schema applied via migration 012.

## What Remains (Tracked In Sprint 2 Tickets)

- Service-layer helpers in `lib/import` for creating/updating sources, creating batches, inserting rows, and grouping rows by outcome.
- Admin UI for source registry management.
- Admin UI for creating import batches through adapters.

## Acceptance Criteria

- API, agent scrape, table scrape, CSV upload, and CSV paste can all create the same kind of import batch record (service layer — Sprint 2).
- Trusted sources can be explicitly configured by admin-owned data (admin UI — Sprint 2).
- Raw import input and normalized row outcomes are preserved for audit and debugging (schema done, service Sprint 2).

## Verification

- Schema setup check for new tables and indexes done.

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Sprint 2: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
