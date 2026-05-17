# TICKET-048: Travel Cache Admin Visibility

Status: open
Owner: Admin / Backend
Priority: medium
Depends on: TICKET-040, TICKET-046

## Purpose

Give admins visibility into travel cache coverage before launch without adding full travel-cache management UI.

## Work

- Add a protected admin travel cache page.
- Show origin postcode district, venue, distance, driving minutes, public transport minutes, provider, and calculated date.
- Add filters for missing travel, distance-only, stale, and failed lookup states where data exists.
- Treat rows older than 90 days as stale.
- Include venue links and public/search context where useful.
- Show explanatory copy that travel estimates are cached and best-effort.
- Link to existing manual fill commands in docs or admin help text.
- Do not add edit/delete/recalculate UI in v1.

## Acceptance Criteria

- Admins can inspect travel cache coverage and staleness.
- Missing or distance-only travel can be identified without querying the database manually.
- Staleness threshold is 90 days.
- The page is read-only and protected by admin auth.

## Verification

- Service tests for travel cache filtering.
- Manual admin page review with seeded cache rows.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Existing docs: [docs/travel-cache.md](../../travel-cache.md)
