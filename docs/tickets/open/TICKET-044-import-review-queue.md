# TICKET-044: Import Review Queue

Status: open
Owner: Admin / Backend
Priority: high
Depends on: TICKET-036, TICKET-042, TICKET-043

## Purpose

Create a persistent admin workflow for import exceptions, scrape failures, and import rows that need human follow-up.

This queue is separate from the public corrections queue and the live data-quality dashboard.

## Work

- Add import review item storage linked to import batches and rows.
- Support statuses `open`, `in_review`, `resolved`, and `ignored`.
- Require notes when ignoring an item.
- Store severity, issue type, source, affected row/entity, evidence, and recommended action.
- Create review items for:
  - static URL scrape failure
  - agent evidence below threshold
  - ambiguous club aliases
  - manual/fuzzy club match suggestions
  - unmatched explicit venue
  - assumed kickoff time where configured for review
  - missing ticket URL or price where configured for review
  - hidden-public fixture due to missing usable coordinates
- Add protected admin list/detail pages.
- Allow status transitions with audit logging.
- Link review items back to fixture, venue, club, source, or batch admin pages when available.

## Acceptance Criteria

- Import exceptions are visible after the import run that created them.
- Admins can move review items through the four statuses.
- Ignored review items cannot be saved without notes.
- Review items preserve source/evidence context needed for later agentic workflows.
- The queue remains separate from public corrections.

## Verification

- Service tests for review item creation and status transitions.
- Admin route/API tests where practical.
- Audit log check for status changes.
- Manual admin review flow.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
