# Ranking And Location Workstream

## Ownership

- Postcode normalization.
- User and venue geocoding.
- Distance calculation.
- Age eligibility and concession price logic.
- Ranking score and reasons.

## Current Behavior

- Postcodes are normalized to UK outward/inward format.
- Seed postcode coordinates power the first iteration.
- Tickets with explicit incompatible age bounds are filtered.
- Concession prices apply when the user's age matches source metadata.
- Ranking favors available tickets, official sources, shorter distance, and lower effective price.

## Next Work

- Replace seed postcode coordinates with a geocoder adapter.
- Expand tests for youth, senior, and unavailable ticket cases.
- Calibrate score weights using real ticket examples.
