# TICKET-054: Centralise domain enums and validation

Status: open
Owner: Backend
Priority: high
Depends on: none

## Purpose

Important domain values are repeated in SQL CHECK constraints, TypeScript string types,
form handling, UI dropdowns, and service logic. This creates hidden mismatch between "what
the DB allows", "what the UI sends", and "what the service assumes".

## Scope

Values to centralise:

- `coordinate_precision`: `exact`, `postcode`, `ground_approximate`, `unknown`
- `coordinates_confidence`: `high`, `medium`, `low`, `unknown`
- Fixture `status`: `scheduled`, `postponed`, `cancelled`, `finished`, `unknown`
- `kickoff_time_status`: `confirmed`, `assumed`, `unknown`
- Club `status`: `complete`, `partial`, `draft`
- Price `confidence`: `verified`, `imported`, `inferred`, `approximate`, `unknown`
- Fixture `confidence`: same as price
- Source `trust_level`: `high`, `medium`, `low`
- `approval_status` and `parse_status` values
- `sale_mode`: values used in ticket price overrides

## Work

1. Create `lib/domain/constants.ts` with canonical arrays and Zod schemas for each enum.
2. Export both the array (for UI dropdowns, CHECK constraints) and the Zod schema (for parsing).
3. Use in admin form parsing, service input validation, UI dropdowns, and migration/schema generation where practical.
4. Remove inline string literals from service code, replacing with references to constants.

## Why

A lot of review issues so far have been caused by hidden mismatch between
“what the DB allows”, “what the UI sends”, and “what the service assumes”.
Centralising these values would prevent an entire class of bugs.
