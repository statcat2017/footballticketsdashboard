# TICKET-002: Implement Ingestion Adapter Contract

Status: done
Owner role: Backend ingestion
Priority: P0
Depends on: TICKET-001

## Goal

Add the shared backend contract that all public ticket opportunity adapters must use.

## Scope

- In scope:
  - `TicketSourceAdapter` interface.
  - source registry.
  - adapter diagnostics.
  - compliance guard conventions.
  - test harness for adapter contract tests.
- Out of scope:
  - Implementing real club adapters.
  - Implementing platform-specific parsers.
  - Changing dashboard UI.

## Acceptance Criteria

- Adapters can return `TicketOpportunityLead[]` and diagnostics.
- Adapter results include source provenance.
- Contract prevents direct ranked `TicketResult` emission from opportunity-only sources.
- Contract tests cover successful leads, empty source, blocked source, and parser failure.

## Implementation Notes

- Keep the existing seed-backed dashboard working.
- Do not remove `TicketResult`; keep it separate from opportunity leads.

## Resolution

- Added the shared ingestion module under `lib/ingestion`.
- Added `TicketOpportunityLead` TypeScript types separate from existing `TicketResult`.
- Added `TicketSourceAdapter`, result helpers, diagnostics, compliance helpers, and source registry.
- Added fake-adapter contract tests covering success, empty source, blocked source, parser failure, invalid provenance, and duplicate registry IDs.
- Updated ingestion and QA workstream docs with the implemented contract and test expectations.

## Tests

- Unit tests for adapter contract helpers.
- Contract tests for a fake adapter.

## Docs To Update

- `docs/workstreams/data-ingestion.md`
- `docs/workstreams/qa.md`
