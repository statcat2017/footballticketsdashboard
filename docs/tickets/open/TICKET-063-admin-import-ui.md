# TICKET-063: Admin Import UI

Status: open
Owner: Admin / Frontend / Backend
Priority: high
Depends on: TICKET-059, TICKET-060, TICKET-061, TICKET-062

## Purpose

Build the admin pages for creating fixture imports and reviewing/previewing batches before applying. This ties the foundation service, adapters, validation, and apply action into a usable admin workflow.

## Work

### New-Import Page (`/admin/imports/new`)

A protected admin page with two import modes:

**Mode 1: CSV Paste**
- Textarea for pasting CSV data.
- Optional season selector (dropdown of `fixture_seasons` labels).
- Optional actor override (defaults to current admin actor).
- Optional column mapping override for power users (keyed by source header → standard `NormalizedFixtureRow` field).
- "Preview" button → validates client-side basics then creates batch server-side → redirects to batch preview page.

**Mode 2: HTML URL Import**
- URL input field.
- Optional season selector and actor override.
- "Detect tables" button → server fetches URL, returns detected tables as JSON.
- Table picker UI:
  - Each detected table shows:
    - Index/number
    - Caption or nearest heading
    - Row count
    - Detected columns (mapped to standard fields where recognised)
    - Fixture-likeness score
    - Sample rows (first 3 cells)
  - Checkbox per table to select/deselect.
  - Column mapping: for each selected table, show auto-detected mapping and allow manual override.
- "Import selected" button → creates batch from selected tables → redirects to batch preview page.

**Source management:**
- URL imports: auto-create/lookup source by URL origin. Show source name in preview.
- CSV imports: prompt for source name or select from existing sources. Default to "Manual CSV Paste" if no source specified.
- Add a simple source list link (`/admin/imports/sources`) for reference.

### Batch Preview Page (`/admin/imports/[id]`)

Show import batch details:

**Header:**
- Batch ID, source name, adapter type, season label, actor, created date.
- Row totals: total, insert, update, blocked, skipped/pending, warnings.
- Parse status and any batch-level parse errors.

**Grouped rows (by current `match_result` outcome):**

Each group as a collapsible section (same pattern as data quality dashboard):

- **Insert** (green) — rows that pass all structural checks and will create a fixture.
  - Show entity: home vs away, competition, date, venue.
  - Show any warnings (assumed time, missing ticket, imprecise venue).
- **Update** (green/blue) — rows that pass all structural checks and will update an existing fixture.
  - Show matched fixture identity and before/after fields where available.
  - Show any warnings (assumed time, missing ticket, imprecise venue).
- **Blocked** (red) — rows with structural failures.
  - Show entity + failure reason(s).
  - Link to relevant admin pages for resolution:
    - Unknown club → link to club search.
    - No mapping → link to publish page for relevant division.
    - Missing venue → link to venue management.
    - Unpublishable competition → link to publish page.
    - Ambiguous club → show possible club matches and suggest adding/scoping an alias.
- **Skipped/Pending** (amber/grey) — rows that are valid but intentionally skipped, or have not been validated yet.

**Apply section:**
- Summary: "N of M rows ready to apply" where N is insert + update rows.
- Confirm checkbox acknowledging the action.
- "Apply safe rows" button → POST to `/api/admin/imports/[id]/apply`.
- After apply: show result summary (X inserted, Y updated, Z skipped).
- Disable apply button after successful apply.

### API Routes

- `POST /api/admin/imports/preview-csv` — accepts CSV text + options → creates batch → returns batch ID + row counts. (Returns JSON or redirect.)
- `POST /api/admin/imports/preview-url` — accepts URL + options → fetches, detects tables → returns table list as JSON.
- `POST /api/admin/imports/create-from-url` — accepts URL + selected tables + options → creates batch → returns batch ID.
- `GET /api/admin/imports/[id]` — returns batch metadata + grouped row summaries (paginated or limited).
- `POST /api/admin/imports/[id]/apply` — validates CSRF, confirms, calls `applyBatchRows()`, returns result summary.

### Navigation

- Link from admin dashboard to `/admin/imports/new`.
- List recent batches at `/admin/imports` (or keep it minimal — link from new page back to recent batches).
- Link from data quality dashboard (unpublished divisions, unmapped clubs) to import workflow where relevant.

## Acceptance Criteria

- Admin can paste CSV → preview grouped rows → apply → fixtures created/updated.
- Admin can enter URL → detect tables → select → preview → apply → fixtures created/updated.
- Blocked rows are clearly explained with resolution links.
- Apply result is visible on the batch page after action.
- Everything is protected by existing admin auth and CSRF.
- UI matches existing admin design patterns (inline styles, no CSS framework).

## Verification

- Service tests for preview and apply API routes, including current `match_result` values.
- Manual flow: CSV paste → preview → apply → verify fixtures.
- Manual flow: URL → detect → select → preview → apply → verify fixtures.
- Manual flow: blocked rows → verify explanation and resolution links.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Sprint: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
- Foundation service: [TICKET-059](./TICKET-059-fixture-import-foundation-service.md)
- CSV adapter: [TICKET-060](./TICKET-060-csv-paste-import-adapter.md)
- HTML adapter: [TICKET-061](./TICKET-061-static-html-table-url-import-adapter.md)
- Validation & apply: [TICKET-062](./TICKET-062-fixture-import-validation-matching-manual-apply.md)
