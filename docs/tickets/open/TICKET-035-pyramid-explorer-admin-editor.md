# TICKET-035: Pyramid Explorer And Admin Edge Editor

Status: partially-done — Phases 1-2 complete (schema backfill, data service, public `/pyramid` page); Phases 3-5 remain (graph component, admin editor, validation)
Owner: Frontend / Data
Priority: high
Depends on: TICKET-034

## Purpose

Build an interactive pyramid explorer that visualises the men's English pyramid from the database, supports club search and division focus, and doubles as an admin interface for maintaining promotion/relegation movement paths and division layout order.

This feature turns the pyramid model into a navigable product surface and moves edge maintenance out of TypeScript constants and into audited admin workflows.

## Current Status

Sprint handoff: 2026-05-16.

- Phase 1 merged in PR #79.
- Phase 2 merged in PR #81.
- Current `main` includes `lib/db/pyramid-explorer.ts` and `tests/pyramid-explorer.test.ts`.
- The Phase 2 review fix is included: nested clubs are keyed by `division_id`. The service now reads from `division_assignments` (migration 020 replaced `pyramid_season_divisions`).
- Next boot-up should begin Phase 3 on a new branch from `main`.

## Next Steps

- Build the shared graph rendering foundation before adding the public route.
- Add deterministic horizontal and vertical layout helpers.
- Add visual edge derivation that collapses reciprocal promotion/relegation pairs.
- Render fixed connections as solid black, allocation-dependent connections as dotted black, and one-way edges as warning arrows.
- Add tests for layout ordering, reciprocal edge collapsing, and one-way edge classification.

## Work

- Add schema metadata for graph layout and edge semantics.
- Build a shared React/SVG pyramid graph component used by both public and admin pages.
- Add public `/pyramid` read-only explorer.
- Add protected `/admin/pyramid` editor with edge CRUD and division ordering controls.
- Add latest-season club search that centres the graph on a club's division.
- Add admin APIs and services for edge create/update/delete and division order moves.
- Add topology, service, API, and rendering tests.
- Document the implementation plan in `docs/pyramid-explorer-spec.md`.

## Sub-Phases

### Phase 1: Schema And Data Backfill (Complete)

- Add `pyramid_divisions.display_order`.
- Add `pyramid_edges.allocation_type`, `notes`, and `source_url`.
- Backfill `display_order` from current division order within each level.
- Backfill `allocation_type = 'fixed'` for edges between divisions at levels 1-6.
- Backfill `allocation_type = 'allocation_dependent'` for any edge touching level 7+.
- Update seed constants, D1 seed paths, schema docs, and tests.
- Merged in PR #79.

### Phase 2: Explorer Data Service (Complete)

- Add `getPyramidExplorerData()` service reading from DB tables.
- Return divisions, edges, latest-season memberships, club search records, and derived visual connections.
- Keep TypeScript constants as seed data only.
- Merged in PR #81.
- The service reads latest-season divisions through `division_assignments` and keys nested clubs by `division_id`.

### Phase 3: Shared Graph Component (Next)

- Build custom React/SVG graph component.
- Default horizontal layout: Premier League left, each level one slot to the right.
- Add vertical layout toggle via URL query.
- Collapse reciprocal promotion/relegation edge pairs into one visual connection.
- Render fixed paths as solid black and allocation-dependent cross-family paths as dotted black.
- Render non-reciprocal edges as arrowed warning edges.
- Support pan/zoom, division focus, and centering.

### Phase 4: Public `/pyramid`

- Add public read-only explorer route.
- Add club search against latest-season memberships.
- Clicking/searching centres on the division and opens a detail panel.
- Detail panel shows clubs, incoming/outgoing movement paths, and allocation notes.

### Phase 5: Admin `/admin/pyramid`

- Add protected admin explorer route using the shared graph component.
- Add side panel controls for division details, edge list, edge CRUD, and move up/down layout order.
- Add CSRF-protected admin APIs.
- Audit every edge and layout mutation.

### Phase 6: Validation And Hardening

- Add topology tests for reciprocal pairing, adjacent-level enforcement, duplicate rejection, and bottom/top boundary rules.
- Add service/API tests for create/update/delete/move operations.
- Add component tests for search, centering, orientation toggle, and detail panel rendering.
- Run lint, tests, and build.

## Acceptance Criteria

- `/pyramid` renders a read-only explorer from DB data, not TypeScript constants.
- `/admin/pyramid` requires admin auth and uses the same graph component with editing controls enabled.
- Horizontal layout is default; vertical layout is available via URL query.
- Clicking a division centres it and opens a detail panel.
- Searching for a club in the latest season centres the graph on that club's division.
- Reciprocal movement edges render as one black connection.
- Allocation-dependent cross-family paths render as dotted black connections.
- One-way configured edges render as warning arrow edges.
- Admins can create, update, and delete edges with CSRF, validation, and audit logs.
- Admin edge creation offers a reciprocal edge checkbox enabled by default.
- Admins can move divisions up/down within a level and persist `display_order`.
- Edge create/update rejects duplicate edges and non-adjacent levels.
- Docs describe edge semantics as recognised possible movement/allocation paths, not guaranteed annual movements.

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual: visit `/pyramid`, search for a known club, click divisions, toggle orientation.
- Manual: visit `/admin/pyramid`, add/update/delete an edge, verify audit log row, verify reciprocal behaviour.
