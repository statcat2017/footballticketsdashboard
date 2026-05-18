# TICKET-056: Standardise transaction boundaries for service writes

Status: open
Owner: Backend
Priority: high
Depends on: none

## Purpose

The repo now has an `AppDatabase.transaction()` abstraction and venue update uses it
to group travel-cache invalidation, venue update, and audit logging. That is the
right pattern. But other service writes still perform update + audit or multi-step
changes as separate writes.

## Work

1. Enforce the rule: any service function that performs more than one write must use
   `db.transaction()`.
2. Apply consistently to:
   - club updates
   - venue creation
   - venue assignment changes
   - publish actions
   - alias add/retire
   - import batch finalisation
   - any "update + audit log" path
3. Add tests proving rollback behaviour for each transactional path.

## Why

This is an admin system where half-written state is painful. The code already has
audit logging, mappings, cache invalidation, and import state. Those are exactly
the places where transactional consistency matters.
