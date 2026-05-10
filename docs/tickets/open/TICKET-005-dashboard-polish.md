# TICKET-005: Dashboard Polish

Status: review
Owner: Frontend
Priority: high
Depends on: TICKET-004

## Purpose

Make the dashboard credible as a pitch demo for Non League Day and Football Web Pages.

## Work

- Tighten the top search bar and result rows.
- Add clear labels for demo/historical data.
- Show best-effort price disclaimer without overwhelming the UI.
- Add empty, loading, and error states that explain close-season/demo behavior.
- Add a short “prototype for non-league expansion” note.

## Acceptance Criteria

- A new visitor understands what the demo is and what it is not.
- Fixture rows are scannable on mobile and desktop.
- No wording implies live availability or guaranteed pricing.

## Verification

- Playwright happy-path test.
- Manual mobile-width review.
