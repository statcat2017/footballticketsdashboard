# Pyramid Explorer And Admin Edge Editor Spec

## Goal

Build an interactive pyramid explorer for the men's English pyramid that also serves as the admin interface for maintaining promotion/relegation movement paths and graph layout order.

The explorer should make the pyramid understandable to users while giving admins a safe, audited way to maintain division ordering and recognised movement/allocation paths.

## Current Status

Sprint handoff: 2026-05-16.

- Phase 1 is complete and merged in PR #79: schema metadata, migration backfill, seed/D1 paths, and migration-only tests.
- Phase 2 is complete and merged in PR #81: `getPyramidExplorerData()`, explorer read-model types, and service tests.
- The explorer read model now reads divisions from `pyramid_season_divisions` for the latest season, keys nested clubs by `division_id`, and verifies nested club counts against memberships.
- Next boot-up should start with Phase 3: shared graph rendering components.

## Next Boot-Up

Start from `main` and create a new branch, for example `feat/pyramid-graph-rendering`.

Recommended first implementation slice:

- Add shared pyramid component types derived from `PyramidExplorerData`.
- Add deterministic layout helper for horizontal and vertical orientations.
- Add visual edge derivation that collapses reciprocal promotion/relegation pairs into one connection.
- Add the initial SVG graph component for all 52 divisions and 129 edges, with static selection/highlight behavior before pan/zoom polish.
- Keep `/pyramid` route wiring for Phase 4 unless the graph needs a small development harness.

Validation target for the next slice:

- Unit-test layout ordering and visual edge derivation.
- Confirm `npm run lint`, `npm run test`, and `npm run build` pass before handoff.

## Non-Goals

- Do not implement the season league swapper in this ticket.
- Do not add clubs to currently empty divisions.
- Do not publish pyramid data to public fixture-search tables.
- Do not model Level 11 regional feeder leagues in this ticket.
- Do not add drag-to-connect graph editing in this version.
- Do not add edge history/versioning beyond audit log entries.

## Product Decisions

| Area | Decision |
|---|---|
| Surfaces | Shared graph component used by `/pyramid` and `/admin/pyramid` |
| Public route | `/pyramid`, read-only |
| Admin route | `/admin/pyramid`, protected editor |
| Data source | Database tables are source of truth |
| Seed constants | Remain seed input only |
| Rendering | Custom React/SVG, no graph library |
| Default orientation | Horizontal left-to-right |
| Alternate orientation | Vertical via URL query |
| Node column/slot | Derived from `pyramid_divisions.level` |
| Node row/order | Stable via `pyramid_divisions.display_order` |
| Edge semantics | Recognised possible movement/allocation paths |
| Edge metadata | `allocation_type`, `notes`, `source_url` |
| Admin editing | Form-driven side panel |
| Reciprocal edge creation | Checkbox default on |
| Edge deletion | Hard delete with audit log |
| Club search | Latest-season memberships only |

## Routes

### `/pyramid`

Public read-only explorer.

Capabilities:

- Render full Level 1-10 pyramid from DB data.
- Default to horizontal layout.
- Support `?layout=vertical`.
- Support `?division=<division-code-or-id>` for centred initial state.
- Support latest-season club search.
- Clicking a division centres the graph and opens a detail panel.
- Detail panel includes division name, level, max size, current club count, club list, promotion paths, relegation paths, and allocation notes.

### `/admin/pyramid`

Protected admin editor.

Capabilities:

- Everything from public explorer.
- Add, edit, and delete movement edges.
- Move selected division up/down within its level.
- Edit edge metadata: allocation type, notes, source URL.
- Create reciprocal edge by default when adding an edge.
- Show validation errors inline.

## URL State

Supported query parameters:

| Query | Values | Purpose |
|---|---|---|
| `layout` | `horizontal`, `vertical` | Graph orientation |
| `division` | division id or code | Select and centre division |
| `club` | club id | Select club and centre its division |

URL state should be shareable. UI state that does not matter for sharing, such as panel collapsed state, can stay client-local.

## Schema Changes

Add migration:

```sql
ALTER TABLE pyramid_divisions ADD COLUMN display_order INTEGER;

ALTER TABLE pyramid_edges ADD COLUMN allocation_type TEXT
  NOT NULL DEFAULT 'allocation_dependent'
  CHECK (allocation_type IN ('fixed', 'allocation_dependent'));

ALTER TABLE pyramid_edges ADD COLUMN notes TEXT;
ALTER TABLE pyramid_edges ADD COLUMN source_url TEXT;
```

Update `schema.ts` and migration docs accordingly.

### Backfill Rules

`pyramid_divisions.display_order`:

- For each `level`, order by current seed array order.
- Assign contiguous integer values starting at `1`.

`pyramid_edges.allocation_type`:

- `fixed` if both connected divisions are at level `<= 6`.
- `allocation_dependent` if either connected division is at level `>= 7`.
- Admins can override this classification.

### Future Schema

Do not implement now, but keep schema compatible with later additions:

- `effective_from_season`
- `effective_to_season`
- `edge_label`
- `reviewed_at`
- `reviewed_by`

## Data Semantics

`pyramid_edges` represents recognised possible movement/allocation paths, not guaranteed annual movements.

Examples:

- Championship to League One is effectively fixed.
- Combined Counties Premier South to Isthmian South Central, Isthmian South East, or Southern League Division One South is allocation-dependent.
- NLS allocation can vary by geography, vacancies, lateral movement, and committee decisions.

The UI must avoid saying "will promote to" for allocation-dependent edges. Use copy such as:

- Fixed: "Promotes to Championship"
- Allocation-dependent: "May be allocated to one of these divisions"

## Visual Model

### Nodes

Each division is rendered as a node.

Node fields:

- `id`
- `code`
- `name`
- `level`
- `max_size`
- `display_order`
- `club_count`
- `clubs[]` for latest season

Horizontal layout:

- `x = level * columnWidth`
- `y = display_order * rowHeight` within that level

Vertical layout:

- Swap axes: `y = level * rowHeight`, `x = display_order * columnWidth`.

### Edges

The renderer receives directed DB edges but displays visual connections.

Rules:

- Reciprocal promotion/relegation pair collapses into one black connection.
- Fixed connection renders as solid black.
- Allocation-dependent connection renders as dotted black.
- Non-reciprocal configured edge renders as arrowed warning edge.
- Selected node highlights connected edges and adjacent divisions.

### Dense Graph Handling

All edges are visible by default. To reduce clutter:

- Use low-opacity lines by default.
- Use stronger stroke on hover/selection.
- Keep node labels above edge lines.
- Add subtle bundling/curves where multiple edges share source/target levels.

## Interaction Design

### Public Detail Panel

Opened by clicking a division or selecting a club search result.

Shows:

- Division name and level.
- Club count and max size.
- Latest-season club list.
- Promotion paths grouped by fixed and allocation-dependent.
- Relegation paths grouped by fixed and allocation-dependent.
- Source/notes where present.

### Admin Detail Panel

Includes all public details plus:

- Move division up/down buttons.
- Incoming edge list.
- Outgoing edge list.
- Add edge form.
- Edit edge metadata form.
- Delete edge button.

### Edge Add Form

Fields:

- Source division, default selected division.
- Target division.
- Movement type: `promotion` or `relegation`.
- Allocation type: `fixed` or `allocation_dependent`.
- Notes.
- Source URL.
- Create reciprocal edge checkbox, checked by default.

Validation:

- Source and target required.
- Source and target must be different.
- Source and target levels must differ by exactly 1.
- Duplicate edge rejected.
- Reciprocal edge duplicate should not fail the whole request; return warning or skip existing reciprocal.

## Service Layer

Create `lib/admin/pyramid.ts` and shared read helpers as needed.

Recommended functions:

```ts
getPyramidExplorerData(): Promise<PyramidExplorerData>
createPyramidEdge(input): Promise<void>
updatePyramidEdge(edgeId, input): Promise<void>
deletePyramidEdge(edgeId): Promise<void>
movePyramidDivision(divisionId, direction): Promise<void>
```

`getPyramidExplorerData()` should return:

```ts
interface PyramidExplorerData {
  season: { id: number; label: string };
  divisions: ExplorerDivision[];
  edges: ExplorerEdge[];
  clubs: ExplorerClubSearchRow[];
}
```

## API Routes

Admin-only mutation routes:

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/pyramid/edges` | POST | Create edge, optionally reciprocal |
| `/api/admin/pyramid/edges/[id]` | POST | Update edge metadata |
| `/api/admin/pyramid/edges/[id]/delete` | POST | Delete edge |
| `/api/admin/pyramid/divisions/[id]/move` | POST | Move division up/down within level |

All routes:

- Require admin session.
- Require CSRF.
- Validate input.
- Write audit log.
- Redirect back to `/admin/pyramid` with selected division preserved where possible.

## Components

Suggested structure:

```text
app/pyramid/page.tsx
app/admin/pyramid/page.tsx
app/components/pyramid/PyramidExplorer.tsx
app/components/pyramid/PyramidGraph.tsx
app/components/pyramid/PyramidDetailPanel.tsx
app/components/pyramid/PyramidSearch.tsx
app/components/pyramid/PyramidAdminPanel.tsx
app/components/pyramid/pyramidLayout.ts
app/components/pyramid/pyramidGraphTypes.ts
```

Client/server split:

- Pages fetch DB data server-side.
- Graph and interactions live in client components.
- Admin mutation forms use normal POSTs with hidden CSRF tokens unless live editing becomes necessary.

## Accessibility

- Division nodes must be keyboard-focusable.
- Search input must be labelled.
- Detail panel must have a heading and focus management when opened from keyboard.
- Edge information must be available textually in the detail panel, not only through SVG lines.
- Move up/down controls must be buttons, not drag-only interactions.

## Tests

### Schema / Seed

- Migration applies to SQLite.
- Seeded divisions get `display_order`.
- Seeded edges get `allocation_type`.
- Setup remains idempotent.

### Topology

- All edges connect adjacent levels.
- Duplicate edges rejected.
- Reciprocal visual pairing works.
- Non-reciprocal edge is classified as warning for rendering.
- Every Level 2-9 division has a route up.
- Every Level 1-9 division has a route down.
- Every Level 9 division has Step 4 promotion and Step 6 relegation paths.
- Every Level 10 division has Step 5 promotion paths.

### Services

- `getPyramidExplorerData()` returns latest season memberships.
- Club search rows include division id/code/name.
- Create edge validates adjacent levels.
- Create edge with reciprocal creates both rows atomically.
- Update edge changes metadata and writes audit log.
- Delete edge removes row and writes audit log.
- Move division swaps display order within level and writes audit log.

### UI

- Public route renders graph.
- Admin route requires auth.
- Search selects and centres a division.
- Orientation toggle changes layout and URL.
- Clicking a division opens detail panel.
- Admin panel shows edge form for selected division.

## Sub-Phases

### Phase 1: Schema And Seed Metadata (Complete)

Deliverables:

- Migration for `display_order`, `allocation_type`, `notes`, `source_url`.
- Update `schema.ts`.
- Update seed constants/types.
- Backfill logic in seed path.
- Tests for setup counts and metadata defaults.

Implemented in PR #79.

Exit criteria:

- DB setup idempotent.
- Existing pyramid tests pass.

### Phase 2: Read Model (Complete)

Deliverables:

- `getPyramidExplorerData()`.
- Type definitions for explorer data.
- Latest-season club search rows.
- Unit tests.

Implemented in PR #81.

Implementation notes:

- `lib/db/pyramid-explorer.ts` exports `getPyramidExplorerData()` and the explorer data types.
- Division rows are scoped to the latest season via `pyramid_season_divisions`.
- Nested division clubs are keyed by `division_id`, not `season_division_id`.
- Tests assert nested club counts match `club_count` and total memberships.

Exit criteria:

- Data returned from DB only.
- No public explorer imports `MEN_PYRAMID_*` constants directly.

### Phase 3: Graph Rendering (Next)

Deliverables:

- Shared `PyramidExplorer` and SVG graph.
- Horizontal and vertical layouts.
- Edge pairing and styling.
- Selection and centering.

Exit criteria:

- Static render works for all 52 divisions and 129 edges.
- Search and selection update UI state.

### Phase 4: Public Explorer

Deliverables:

- `/pyramid` route.
- Public search and detail panel.
- Metadata copy for fixed vs allocation-dependent paths.

Exit criteria:

- Public explorer usable without admin auth.

### Phase 5: Admin Editor

Deliverables:

- `/admin/pyramid` route.
- Edge add/update/delete forms.
- Division move up/down controls.
- Admin APIs.
- Audit logging.

Exit criteria:

- Admin can maintain edge metadata and layout without editing TypeScript constants.

### Phase 6: Hardening And Documentation

Deliverables:

- Full test coverage listed above.
- Update admin docs.
- Update ticket status notes if needed.

Exit criteria:

- `npm run lint`
- `npm run test`
- `npm run build`

## Open Questions For Implementation

- Whether admin edge updates should redirect or use `fetch` for inline updates.
- Whether public `/pyramid` should be statically cached or always dynamic from DB.
- Exact pan/zoom implementation details for mobile.
- Whether club search should include aliases immediately or wait until alias data is stronger.

## Risks

- Edge density may make all-edge rendering visually cluttered.
- Allocation-dependent paths are semantically subtle; copy must avoid over-promising.
- Admin edge editing can break topology if validation is incomplete.
- SVG pan/zoom can become fiddly on mobile.

## Future Work

- Add `effective_from_season` and `effective_to_season` for edge history.
- Add edge provenance review workflow.
- Add drag-to-connect editing.
- Add Level 11 regional feeder leagues if product scope justifies ambiguity.
- Integrate with season league swapper.
