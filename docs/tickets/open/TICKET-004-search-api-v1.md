# TICKET-004: Search API V1

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-001

## Purpose

Define and stabilize the product API that the frontend and future partner integrations will use.

## Work

- Keep `POST /api/search` as the main API.
- Validate postcode, radius, date range, and optional competition filter.
- Return fixture cards with price, source URL, distance, travel cache state, and demo/historical flags.
- Add explicit metadata for stale/fallback data.

## Acceptance Criteria

- API response shape is documented.
- Bad input returns useful 400 errors.
- Empty live windows fall back to labelled historical demo fixtures.

## Verification

- API route tests.
- Search service tests.
