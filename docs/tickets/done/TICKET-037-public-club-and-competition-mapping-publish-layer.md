# TICKET-037: Public Club And Competition Mapping Publish Layer

Status: done
Owner: Backend / Admin
Priority: high
Depends on: TICKET-036

## Purpose

Bridge the admin pyramid model to the public search model so fixtures can be imported for all populated pyramid divisions without duplicating club data manually.

Existing public fixtures reference `clubs` and `competitions`, while admin maintenance primarily uses `pyramid_clubs`, `pyramid_divisions`, and venue assignments.

## Work

- Add an explicit mapping from `pyramid_clubs` to public `clubs`.
- Add an explicit mapping from `pyramid_divisions` to public `competitions`.
- Build an admin bulk publish/link flow for populated pyramid divisions.
- Create deterministic public competition codes from pyramid division codes.
- Bulk-create or link public club rows for mapped divisions when clubs have a current primary venue.
- Copy canonical club name, aliases where appropriate, current primary venue, source URL, verified date, and ticket URL defaults when available.
- Do not create public clubs for pyramid clubs without a primary venue.
- Surface unmapped or unpublishable clubs/divisions with clear admin warnings.
- Audit all create/link/update mapping operations.

## Acceptance Criteria

- Admins can publish/link public competitions for populated pyramid divisions before fixture imports run.
- Admins can publish/link public clubs for populated mapped divisions when required venue data exists.
- Fixture import can resolve public club and competition IDs through explicit mappings.
- Missing primary venues prevent public club creation and appear as actionable admin issues.
- The import pipeline does not create public clubs or competitions implicitly.

## Verification

- Service tests for mapping creation and duplicate protection.
- Service tests for bulk publish/link behavior.
- Admin route/API tests where practical.
- Audit log check for mapping operations.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
