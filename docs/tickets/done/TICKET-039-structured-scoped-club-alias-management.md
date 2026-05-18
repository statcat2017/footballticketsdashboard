# TICKET-039: Structured Scoped Club Alias Management

Status: done
Owner: Backend / Admin
Priority: high
Depends on: TICKET-037

## Purpose

Make club matching reliable for API and scrape imports by replacing loose text aliases with structured, normalized, optionally scoped aliases.

## Work

- Add a `club_aliases` table or equivalent structured storage.
- Store canonical public club ID, alias, normalized alias, optional division or competition scope, source, and timestamps.
- Enforce global uniqueness for unscoped normalized aliases.
- Allow scoped duplicates when the scope disambiguates imports, for example nickname-style aliases within a league context.
- Add normalization for case, punctuation, apostrophes, whitespace, and common Unicode variants.
- Build admin UI for viewing, adding, editing, and retiring aliases from club detail pages.
- Migrate existing text aliases where safe, leaving ambiguous values for admin review.
- Add a shared matching service that checks source IDs, canonical names, scoped aliases, unscoped aliases, and suggest-only fuzzy candidates.
- Ensure fuzzy suggestions never auto-approve in v1.

## Acceptance Criteria

- Import matching can restrict aliases by fixture competition or division context.
- Ambiguous aliases block auto-approval and surface actionable review information.
- Admins can add an alias from an import preview/manual resolution flow.
- Duplicate unscoped aliases are rejected.
- Existing club alias behavior is preserved or migrated without silent data loss.

## Verification

- Unit tests for alias normalization.
- Unit tests for scoped and unscoped uniqueness.
- Matching service tests for exact, alias, ambiguous, and suggested matches.
- Admin mutation tests where practical.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
