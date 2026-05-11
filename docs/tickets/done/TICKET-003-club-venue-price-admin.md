# TICKET-003: Club, Venue, And Price Admin

Status: done
Owner: Backend
Priority: high
Depends on: TICKET-001

## Purpose

Make seeded club, venue, and ticket-price data maintainable without editing application code.

## Work

- Move club and venue seed data into editable CSV files.
- Add import validation for required fields, URLs, postcodes, coordinates, and source metadata.
- Support known and unknown ticket pricing states without requiring TypeScript seed edits.
- Seed and import the production D1 dataset from external files.
- Document how to add or update club metadata and seed production data.

## Acceptance Criteria

- Club and venue seed data can be updated without changing TypeScript seed code.
- Invalid data fails loudly.
- Unknown prices can be represented cleanly.
- Production seed data can be loaded into D1 from the external seed files.

## Verification

- Import tests for valid and invalid data.
- `npm run db:setup` loads the external seed files.
- `npm run import:clubs`
- `npm run import:clubs:d1 -- football data/clubs.csv`
