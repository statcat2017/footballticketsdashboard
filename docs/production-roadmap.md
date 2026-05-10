# Production Roadmap

This roadmap gets Near Me FC from the current local demo to a production-ready fixture finder and a credible Non League Day partnership pitch.

## 1. Stabilize The Demo

Purpose: make the current PL/Champ demo reliable enough to show publicly.

- Replace ad hoc seed data with a repeatable SQLite migration/seed command.
- Add a hosted demo environment, ideally GitHub Pages for static marketing plus a small backend host for SQLite/API.
- Polish the dashboard copy so it clearly says this is a prototype showing top-division data while targeting non-league expansion.
- Add fixture, price, travel, and correction test coverage around the current happy path.

## 2. Build The Pitch Asset

Purpose: make it easy for Non League Day or Football Web Pages to understand the value in under two minutes.

- Create a demo landing page or deck explaining the problem: local fixtures are hard to find, prices are scattered, travel friction stops attendance.
- Include screenshots or a live dashboard link using PL/Champ demo data.
- Explain the partnership ask: fixture data access/credibility in exchange for a better finder and attribution.
- Draft outreach messages for James Doe / Non League Day and Football Web Pages.

## 3. Productionize Core Data

Purpose: make the system maintainable once real fixture data arrives.

- Add football-data.org live import for PL/Champ behind a scheduled/manual command.
- Add data admin workflows for club/venue/price updates.
- Add correction review tooling so submitted pricing fixes can be approved or rejected.
- Add source freshness indicators so stale prices and fixtures do not look authoritative.

## 4. Add Travel Properly

Purpose: turn distance into a useful “can I get there?” decision aid.

- Keep postcode-district caching.
- Add OpenRouteService driving-time integration.
- Add TravelTime public transport integration.
- Keep search usable when travel APIs are missing, rate-limited, or fail.
- Add background recomputation for new postcode-district/venue pairs.

## 5. Partnership And Non-League Expansion

Purpose: convert the demo into the actual target product.

- Contact Non League Day with the live demo and partnership proposal.
- Contact Football Web Pages for API/developer access, ideally with NLD context or endorsement.
- If access is granted, implement the non-league fixture adapter.
- Start with Steps 1-3 before going wider.
- Keep pricing as best-effort with corrections, not live ticket availability.

## 6. Launch Readiness

Purpose: prepare for real users, club corrections, and public sharing.

- Add basic analytics and error monitoring.
- Add privacy policy and contact details.
- Add rate limiting/spam protection for corrections.
- Add backup/export for SQLite.
- Add deployment docs and runbook.
- Decide initial monetisation experiment: featured fixture slot, local ad slot, affiliate links, or partnership-first only.

## Suggested Milestones

1. **Demo Ready:** polished local/hosted dashboard using PL/Champ seed/live data.
2. **Pitch Ready:** public demo link, one-page proposal, outreach messages.
3. **Data Ready:** repeatable imports, admin/correction workflow, freshness rules.
4. **Travel Ready:** cached drive/transit estimates with graceful fallback.
5. **Partner Ready:** NLD/FWP outreach sent and tracked.
6. **Non-League Beta:** first partner-backed non-league fixture feed live.
