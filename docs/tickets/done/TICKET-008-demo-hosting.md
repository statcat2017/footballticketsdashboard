# TICKET-008: Demo Hosting

Status: done
Owner: QA/Release
Priority: high
Depends on: TICKET-001, TICKET-005

## Purpose

Put the demo somewhere shareable before outreach.

## Work

- Deploy the Next.js app to Cloudflare Workers with the OpenNext adapter.
- Bind the production D1 database and document deployment setup.
- Add production build and deploy commands plus a smoke test path.
- Publish a stable public demo URL at `https://fixtures.statcat.co.uk`.

## Acceptance Criteria

- The demo can be opened by someone outside the local machine.
- Search works against the seeded/hosted D1 database.
- Deployment steps are documented.

## Verification

- Public URL smoke test: `https://fixtures.statcat.co.uk` returned `HTTP/2 200` on 2026-05-11.
- `npm run build`
- `npm run deploy`
