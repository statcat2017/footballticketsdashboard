# Near Me FC Project Plan

## Summary

Near Me FC is a fixture finder demo intended to support a future Non League Day / Football Web Pages partnership. The first build uses Premier League and Championship seed data to prove the product: location-first fixture discovery, best-effort prices, travel estimates, and correction feedback.

## MVP

- SQLite database at `data/nearmefc.sqlite`.
- Historical/demo PL and Championship fixtures for close-season demos.
- Club-level admission prices with source URLs and visible best-effort disclaimer.
- Search by postcode, radius, and date range.
- Cached travel estimates by postcode district and venue.
- Pending correction submissions.
- Fixture-first UI with horizontal listing cards.

## Admin Data Maintenance

- The admin interface plan lives in `docs/admin-interface-plan.md`.
- Admin tools will manage the pyramid model as the canonical source for club, ground, season, and membership data.
- Public-search tables will be updated through an explicit publish step for supported divisions only.
- The first implementation phase is admin auth, audit logging, transaction support, and foundational schema work.

## Fixture Operations Readiness

- The fixture ingestion and operational readiness plan lives in `docs/fixture-operations-readiness-plan.md`.
- Fixture ingestion should be source-agnostic: API feeds, agentic scrapes, URL table scrapes, CSV upload, and CSV paste all produce import batches with the same validation and approval workflow.
- Trusted API and agentic scrape sources may auto-approve structurally safe rows, while exceptions go to import review.
- Public fixture data should prefer clear caveats and provenance over hiding every incomplete but usable fixture.

## Deferred

- Non-league fixture ingestion until a data partnership/source is agreed.
- Live availability or sold-out claims.
- Automated club ticket scraping.
- Real-time journey planning.
