# TICKET-058: Workflow-level integration tests

Status: open
Owner: Backend
Priority: medium
Depends on: none

## Purpose

The repo has good unit-ish tests around individual service functions and DB adapter
behaviour, but no tests that exercise whole admin workflows against a realistic test DB.
The schema is now complex: pyramid tables, public club tables, mapping tables, aliases,
fixtures, venues, ticket prices, travel cache, corrections and audit logs all in one
database. Unit tests can all pass while a real admin flow breaks because the wrong ID
space, mapping table, or route state is used.

## Work

Add 8–10 high-value integration tests (not dozens):

1. Edit venue coordinates by more than 1 mile → travel cache invalidated → audit written.
2. Edit venue coordinates without confirmation → rejected.
3. Add alias → resolver finds it.
4. Retire alias → resolver no longer finds it.
5. Publish club → public club and mapping are both present.
6. Publish division → mapping points to canonical competition code.
7. Data quality page ignores old-season memberships.
8. Import batch insert/update finalisation does not leave partial state on failure.
9. Venue update inside same-mile delta does not invalidate travel cache.

Each test should use a seeded in-memory SQLite database and go through the public
service API (not internal functions).

## Why

This repo is exactly the sort where unit tests can all pass while a real admin flow
breaks because the wrong ID space, mapping table, or route state is used. This has
already appeared in PR reviews.
