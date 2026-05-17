# TICKET-049: Front-End Screenshot Review Harness

Status: open
Owner: Frontend / QA
Priority: medium
Depends on: TICKET-046

## Purpose

Create a repeatable rendered-page review harness so UX, accessibility, mobile, data-state, and visual consistency reviews are based on screenshots instead of code inspection alone.

## Work

- Add a Playwright screenshot capture script for key public and admin pages.
- Capture mobile, tablet, and desktop viewport sizes:
  - 390 x 844
  - 768 x 1024
  - 1440 x 900
- Capture at least:
  - home/search default
  - results loaded
  - no results
  - API error state where practical
  - public pyramid page
  - admin venues page
  - admin fixtures page once available
- Store generated screenshots outside committed source or document the intended output path if ignored.
- Add review instructions covering UX, accessibility, responsive/mobile, data-state, visual consistency, and front-end code review passes.
- Require findings to be returned as concrete tickets, not broad redesign suggestions.

## Acceptance Criteria

- A developer can run one command to capture the standard screenshot set locally.
- Review instructions explain target user, key journeys, states, severity levels, and output format.
- Generated screenshots are not accidentally committed unless explicitly intended.
- The harness supports launch readiness reviews without changing app behavior.

## Verification

- Run the screenshot command locally against the dev server.
- Confirm ignored/output paths behave as documented.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
