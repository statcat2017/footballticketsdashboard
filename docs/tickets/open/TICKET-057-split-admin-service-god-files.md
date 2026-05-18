# TICKET-057: Split admin service god files into smaller domain modules

Status: open
Owner: Backend
Priority: medium
Depends on: none

## Purpose

`lib/admin/venues.ts` and `lib/admin/clubs.ts` are becoming broad service buckets.

- `venues.ts` handles: list/detail queries, creation, updates, shared-venue confirmation,
  coordinate provenance, travel-cache invalidation, audit logging, date helpers, assignment logic.
- `clubs.ts` handles: club editing, season lookup, publishable division/club logic,
  competition-code derivation.

## Work

Split by behaviour, not by table. Suggested structure:

```
lib/admin/venues/
  queries.ts       — getAdminVenue, getAdminVenueList
  mutations.ts     — createAdminVenue, updateAdminVenue
  validation.ts    — date helpers, coordinate validation
  assignments.ts   — assignAdminVenue

lib/admin/clubs/
  queries.ts       — getAdminClubList, getAdminClubDetail
  mutations.ts     — updateAdminClub
  publishing.ts    — getPublishableDivisions, getPublishableClubs
  competitionCodes.ts — divisionCodeFromName, competitionName, TIER_MAP
```

Keep existing public exports from the barrel `lib/admin/venues/index.ts` and
`lib/admin/clubs/index.ts` so import paths don't change.

## Why

The current pattern is heading toward "big service file with everything in it".
That makes it harder for agents to modify one workflow without accidentally
touching another.
