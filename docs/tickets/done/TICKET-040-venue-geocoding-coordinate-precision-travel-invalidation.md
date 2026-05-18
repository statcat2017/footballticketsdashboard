# TICKET-040: Venue Geocoding, Coordinate Precision, And Travel Invalidation

Status: done
Owner: Admin / Backend
Priority: high
Depends on: TICKET-037

## Purpose

Finish the admin venue cleanup workflow so all populated divisions can be made usable for public postcode search.

## Work

- Add `coordinate_precision` to venues with values such as `exact`, `postcode`, `ground_approximate`, and `unknown`.
- Retain `is_approximate` during the transition for compatibility.
- Add venue coordinate provenance fields where needed: source URL, verified date, confidence, and notes.
- Add postcode lookup to venue edit mode, not only venue create mode.
- Show a lat/lon preview before saving replaced coordinates.
- Require explicit confirmation when replacing existing coordinates.
- Keep Leaflet and postcodes.io as the v1 geocoding implementation.
- Audit coordinate and precision changes.
- Invalidate travel cache rows for a venue only when coordinates move more than one mile.
- Show a post-save notice when travel cache rows were invalidated.

## Acceptance Criteria

- Admins can look up a venue postcode from the edit page and preview the proposed coordinates.
- Admins must explicitly confirm coordinate replacement.
- Coordinate precision is stored and visible in admin venue views.
- Public/search code can still use existing coordinate fields during the transition.
- Travel cache is invalidated only for venue moves over the one-mile threshold.

## Verification

- Unit tests for coordinate movement threshold.
- Service tests for coordinate precision updates and audit logging.
- Manual admin venue edit flow.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
- Existing plan: [docs/admin-interface-plan.md](../../admin-interface-plan.md)
