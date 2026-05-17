# TICKET-045: Fixture Admin CRUD And Public Card Preview

Status: open
Owner: Admin / Frontend / Backend
Priority: high
Depends on: TICKET-037, TICKET-038, TICKET-043

## Purpose

Let admins inspect, correct, verify, and preview fixtures after imports create or update them.

## Work

- Add protected admin fixture list and detail pages.
- Support filtering by season, competition, source, status, assumed time, missing ticket data, and hidden-public location issues.
- Add fixture edit support for home participant, away participant, competition, season, date, kickoff time, time status, fixture status, venue, ticket URL, sale mode, adult price, concession price, source URL, verified date, notes, and demo/historical flags.
- Allow each participant to be a mapped club or an explicit one-off team with display name and source/evidence.
- Make clear in admin UI that one-off teams do not create club records and do not receive aliases, memberships, or club default ticket data.
- Preserve fixture-specific ticket overrides taking precedence over club defaults.
- Audit all admin fixture mutations.
- Extract shared public fixture display formatters or a minimal shared card component.
- Add an admin public-card preview using the same warning, status, price, travel, and CTA copy as public search.
- Ensure postponed and cancelled previews suppress ticket CTA.

## Acceptance Criteria

- Admins can find and edit imported fixtures without direct database edits.
- Admins can create or edit fixtures involving one-off teams without creating public club rows.
- Fixture-specific ticket data overrides club defaults in preview and public display.
- Assumed kickoff times and status labels appear in admin preview.
- Admin preview uses the same display rules as public fixture cards.
- Admin fixture edits are audited.

## Verification

- Service tests for fixture update validation.
- Component or rendering tests for shared display formatting where practical.
- Manual admin CRUD flow.
- Search result regression test for fixture overrides.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
