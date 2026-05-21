# TICKET-022: Non-League Matters Fixture Import Proposal

Status: research complete; implementation deferred
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

## Issue #58 Resolution

Resolved as documentation/research. The current recommendation is not to build a dedicated Non League Matters adapter yet because reuse permission, robots constraints, and venue enrichment are unresolved. The existing import model can stage rows with missing venues, but published fixtures still require `venue_id`, so NLM rows should remain reference/review material until an approved venue source or schema/product change exists.

Follow-up implementation, if the source is approved later, should use the source-agnostic HTML table or agentic import adapter rather than a bespoke scraper first.

## Verification

- Sample scrape notes in the ticket.
- Import/test plan linked from this ticket.
- Current recommendation and blockers documented in the feasibility note.

## Links

- Feasibility note: [docs/non-league-matters-feasibility.md](../../non-league-matters-feasibility.md)
- GitHub issue: https://github.com/statcat2017/footballticketsdashboard/issues/58
