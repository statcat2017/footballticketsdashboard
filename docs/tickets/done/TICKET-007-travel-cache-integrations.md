# TICKET-007: Travel Cache Integrations

Status: done
Owner: Backend
Priority: medium
Depends on: TICKET-004

## Purpose

Add useful travel estimates while keeping the app free or near-free to run.

## Work

- Use postcode district to venue as the cache key.
- Add OpenRouteService driving-time lookup when `OPENROUTESERVICE_API_KEY` exists.
- Add TravelTime public-transport lookup when `TRAVELTIME_APP_ID` and `TRAVELTIME_API_KEY` exist.
- Keep search working with distance-only fallback.
- Store provider, calculated timestamp, and nullable travel values.

## Acceptance Criteria

- Search never fails because travel APIs are unavailable.
- Cached values are reused.
- New uncached pairs can be computed by a background/manual command.

## Verification

- Mocked API tests for success, failure, and missing-key fallback.
- `npm run travel:fill -- "SW6 1HS"`
- `npm run build`
- [docs/travel-cache.md](/Users/ben/footballticketsdashboard/docs/travel-cache.md:1)
