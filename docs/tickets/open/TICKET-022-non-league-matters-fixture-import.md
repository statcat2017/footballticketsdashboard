# TICKET-022: Non-League Matters Fixture Import Proposal

Status: open
Owner: Offline/Partnership
Priority: medium
Depends on: TICKET-012

## Purpose

Evaluate `nonleaguematters.co.uk` as a practical fixture source for future non-league coverage, while keeping venue enrichment and licensing constraints explicit.

## Work

- Inspect the global fixtures page and division pages for reusable fixture fields.
- Confirm robots, terms, and reuse constraints before treating the site as a data source.
- Identify how teams, competitions, dates, and any postcode/venue hints map into the existing SQLite model.
- Decide whether venue enrichment needs a second source or whether non-league fixtures should allow missing venue data.
- Prototype an import path only if the source is acceptable.

## Acceptance Criteria

- The repo has a documented recommendation on whether Non League Matters is usable as a fixture feed.
- Any required schema or import changes are identified before implementation.
- Missing venue data remains explicit rather than silently fabricated.

## Verification

- Sample scrape notes in the ticket.
- Import/test plan linked from this ticket.

## Links

- Feasibility note: [docs/non-league-matters-feasibility.md](../../non-league-matters-feasibility.md)
- GitHub issue: https://github.com/statcat2017/footballticketsdashboard/issues/58
