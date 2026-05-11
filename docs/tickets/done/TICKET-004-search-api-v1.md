# TICKET-004: Search API V1

Status: done
Owner: Backend
Priority: high
Depends on: TICKET-001

## Purpose

Define and stabilize the product API that the frontend and future partner integrations will use.

## Work

- Keep `POST /api/search` as the main API.
- Validate postcode, radius, and date range.
- Return fixture cards with ticket sale mode, adult/concession pricing, source URL, distance, travel cache state, and demo/historical flags.
- Return metadata describing the applied date window, radius, and whether historical fallback was used.

## Acceptance Criteria

- API response shape is documented.
- Bad input returns useful 400 errors.
- Empty live windows return an empty result set without silently falling back to historical demo fixtures.

## Verification

- API route tests.
- Search service tests.
- [docs/search-api.md](/Users/ben/footballticketsdashboard/docs/search-api.md:1)
