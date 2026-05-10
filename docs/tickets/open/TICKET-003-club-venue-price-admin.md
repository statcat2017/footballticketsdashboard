# TICKET-003: Club, Venue, And Price Admin

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-001

## Purpose

Make seeded club, venue, and admission-price data maintainable without editing application code.

## Work

- Move seed data into editable JSON or CSV files.
- Add import validation for required fields, URLs, postcodes, coordinates, and prices.
- Include source URL and verified date for every known price.
- Document how to add or update a club.

## Acceptance Criteria

- Club/venue/price data can be updated without changing TypeScript seed code.
- Invalid data fails loudly.
- Unknown prices can be represented cleanly.

## Verification

- Import tests for valid and invalid data.
- `npm run db:setup` loads the external seed files.
