# TICKET-008: Demo Hosting

Status: open
Owner: QA/Release
Priority: high
Depends on: TICKET-001, TICKET-005

## Purpose

Put the demo somewhere shareable before outreach.

## Work

- Decide hosting split: static marketing page on GitHub Pages plus backend elsewhere, or one small VPS.
- Add deployment environment variables and setup notes.
- Add production build command and smoke test.
- Add a stable public demo URL.

## Acceptance Criteria

- The demo can be opened by someone outside the local machine.
- Search works against the seeded/hosted SQLite database.
- Deployment steps are documented.

## Verification

- Public URL smoke test.
- `npm run build`
