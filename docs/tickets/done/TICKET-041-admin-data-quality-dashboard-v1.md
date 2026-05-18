# TICKET-041: Admin Data Quality Dashboard V1

Status: done
Owner: Admin / Backend
Priority: high
Depends on: TICKET-037, TICKET-038, TICKET-039, TICKET-040

## Purpose

Give admins a daily live view of broken or caveated data before real fixtures are imported and published.

## Work

- Add an admin data-quality dashboard that computes checks live on page load.
- Use severities `error`, `warning`, and `info`.
- Show issue type, entity, issue summary, severity, and direct action link where possible.
- Include checks for:
  - clubs with no primary venue
  - mapped/public clubs missing required venue data
  - venues with blank postcode
  - venues with missing or invalid coordinates
  - venues with approximate or unknown coordinate precision
  - duplicate or ambiguous club aliases
  - clubs with no ticket URL
  - divisions over max size
  - populated divisions without public competition mappings
  - populated clubs without public club mappings
  - fixtures missing source URL
  - fixtures with assumed kickoff times
  - fixtures missing ticket information
  - fixtures hidden from public search due to unusable location
- Treat blank venue postcode as a warning.
- Treat missing or invalid coordinates as an error for public search visibility.
- Treat division over max size as a warning.

## Acceptance Criteria

- Admins can see all current data-quality issues from one page.
- Every issue includes a clear severity and action target when one exists.
- The dashboard does not persist every warning as a workflow item in v1.
- The dashboard is protected by existing admin auth.

## Verification

- Service tests for data-quality checks.
- Snapshot-like tests for severity classification.
- Manual admin page review with seeded issues.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
