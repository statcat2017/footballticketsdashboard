# TICKET-023: NonLeagueHQ Fixture Import Proposal

Status: open
Owner: Offline/Partnership
Priority: medium
Depends on: TICKET-012

## Purpose

Evaluate `nonleaguehq.com` as a practical scrape source for non-league fixtures and club metadata.

## Work

- Inspect the fixture-finder and at-a-glance pages for reusable fields.
- Review club information pages for enrichment data.
- Confirm reuse, robots, and permission constraints before any importer work.
- Identify which fields can map into the existing SQLite model and which need a second source.

## Acceptance Criteria

- The repo has a documented recommendation on whether NonLeagueHQ is usable as a fixture feed.
- Any required schema or import changes are identified before implementation.
- Missing venue data remains explicit rather than silently fabricated.

## Verification

- Sample scrape notes in the ticket.
- Import/test plan linked from this ticket.

## Links

- Feasibility note: [docs/nonleaguehq-feasibility.md](../../nonleaguehq-feasibility.md)
