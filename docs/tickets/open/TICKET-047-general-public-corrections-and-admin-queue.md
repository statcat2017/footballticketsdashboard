# TICKET-047: General Public Corrections And Admin Queue

Status: open
Owner: Frontend / Backend / Admin
Priority: medium
Depends on: TICKET-045, TICKET-046

## Purpose

Let users report fixture, venue, ticket, travel, and club-detail errors through a structured correction flow, then let admins review them separately from import review items.

## Work

- Generalize correction intake beyond price-only submissions.
- Support issue types:
  - `kickoff`
  - `venue`
  - `ticket_price`
  - `ticket_link`
  - `travel`
  - `club_details`
  - `other`
- Add a `Spotted an error?` correction entry point on fixture cards.
- Prefill fixture ID and visible fixture context where available.
- Keep optional email, source URL, and message fields.
- Preserve pending-review behavior; corrections must not auto-apply in this sprint.
- Add an admin corrections queue with statuses, detail view, and audit trail for decisions.
- Keep this queue separate from the import review queue.
- Update public copy to explain that corrections are reviewed before changes appear.

## Acceptance Criteria

- Users can report non-price fixture issues without using email.
- Correction records retain fixture context and issue type.
- Admins can review and transition correction status from a protected admin page.
- Public corrections do not automatically change live fixture data.

## Verification

- API validation tests for each issue type.
- Correction creation tests with and without fixture ID.
- Admin status transition tests where practical.
- Manual fixture-card correction flow.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Related: TICKET-020
- Related: TICKET-021
