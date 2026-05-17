# TICKET-050: Public Pyramid Launch Polish

Status: open
Owner: Frontend / Data
Priority: low
Depends on: TICKET-035, TICKET-040, TICKET-041

## Purpose

Polish the public pyramid explorer enough to support fixture-launch trust without delaying import and admin readiness.

Admin pyramid edge editing remains out of scope unless it blocks division mappings or fixture imports.

## Work

- Show club counts by division.
- Add or refine populated-division and non-league-only toggles.
- Add approximate venue data warnings where relevant.
- Explain fixed versus allocation-dependent movement paths in public copy.
- Add division detail content that helps users understand which clubs and venues are represented.
- Avoid large redesigns or new component libraries.
- Keep changes compatible with the DB-backed pyramid explorer work in TICKET-035.

## Acceptance Criteria

- Public pyramid users can distinguish populated and unpopulated divisions.
- Users can understand approximate venue caveats without opening admin pages.
- Fixed and allocation-dependent paths are explained without implying guaranteed annual movement.
- The work does not block fixture ingestion milestones.

## Verification

- Component or rendering tests where practical.
- Manual mobile and desktop pyramid review.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Related: TICKET-035
