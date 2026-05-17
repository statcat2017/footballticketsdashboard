# TICKET-036: Fixture Source Registry And Import Batch Model

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-027

## Purpose

Create the source and batch primitives required for API, agentic scrape, table scrape, upload, and paste imports to share one ingestion workflow.

This replaces a CSV-centered import design with a source-agnostic model.

## Work

- Add a `fixture_sources` registry for configured fixture sources.
- Store source type, name, base URL or provider key, trust level, auto-approval setting, evidence requirements, last successful import, and failure count.
- Add import batch storage for every source adapter.
- Store batch source, adapter type, season, actor, raw payload reference, parse status, approval status, row counts, and timestamps.
- Add row-level import outcome storage for normalized rows, warnings, evidence, match results, and final insert/update/skip result.
- Retain raw import payloads indefinitely for now, with a size cap and clear validation errors for oversized payloads.
- Add indexes for source, batch status, created date, and row outcome lookups.
- Update schema documentation after implementation.

## Acceptance Criteria

- API, agent scrape, table scrape, CSV upload, and CSV paste can all create the same kind of import batch record.
- Trusted sources can be explicitly configured by admin-owned data, not inferred automatically.
- Raw import input and normalized row outcomes are preserved for audit and debugging.
- Import batch records can represent pending preview, approved, partially approved, failed, and auto-approved states.
- Existing fixture imports keep working until they are migrated onto the new batch model.

## Verification

- Unit tests for source registry validation.
- Unit tests for import batch and row creation.
- Migration test or schema setup check for new tables and indexes.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
