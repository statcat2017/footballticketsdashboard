# TICKET-046: Public Fixture Search Readiness

Status: open
Owner: Frontend / Backend
Priority: high
Depends on: TICKET-038, TICKET-040, TICKET-045

## Purpose

Update public search for real fixture launch so it is useful, honest, and does not imply guaranteed ticket availability or perfect data.

## Work

- Disable demo/historical fallback by default in production behind an `ENABLE_DEMO_FIXTURES` flag.
- Default public search to the next 14 days.
- Add a radius selector such as 25, 50, 100, and all miles.
- Include scheduled, postponed, cancelled, and unknown future fixtures when they match the search window.
- Label postponed and cancelled fixtures prominently and suppress ticket CTA for them.
- Change default ticket CTA copy to `Check club tickets`.
- Add a global best-effort data disclaimer near search results.
- Add compact per-card badges for assumed kickoff time, approximate venue coordinates, missing price, distance-only or missing travel, and fixture status.
- Display one-off fixture participants by their fixture participant display name without linking them to club pages.
- Avoid implying one-off teams are permanent clubs or members of the competition/division.
- Hide fixtures with no usable venue coordinates from public search until fixed.
- Keep historical/demo labels clear when demo flag is enabled.
- Avoid copy that implies live availability, guaranteed prices, exact travel times, or confirmed kickoff times when data is assumed.

## Acceptance Criteria

- Real fixtures are the default public search experience.
- Demo fixtures do not appear unless explicitly enabled.
- Users can restrict result scope by radius.
- Postponed and cancelled fixtures remain findable but are not presented as attendable ticket opportunities.
- Fixtures involving one-off teams render cleanly in public cards and search responses.
- All caveated data is labelled without overwhelming every card with repeated full warnings.

## Verification

- Search service tests for demo flag and hidden-location behavior.
- UI/component tests for status and warning display where practical.
- Manual mobile and desktop review.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
