# TICKET-065: Import Batch Repair Endpoints

Status: open
Owner:
Priority: high
Depends on: TICKET-064

## Purpose

Add a single explicit repair endpoint with action-specific handlers for all permanent source-of-truth fixes that the import batch screen needs. This is Phase 2: the server-side backend that supports the fixture queue UI.

## Work

### 1. Repair endpoint

`POST /api/admin/imports/{batchId}/repairs`

Shared setup per request:

- CSRF and session validation.
- Batch existence check.
- Action dispatch from `_action` form field.

All actions redirect back to `/admin/imports/{batchId}#fixture-{resolvedRowId}` or `#issue-{issueKey}` on success/error.

### 2. Action handlers

#### `create_competition`

- Form fields: `code`, `name`, `kind`, `tier`, `redirect_row_id`.
- Auto-generate code from name with editable default.
- Default `kind='friendly'` when name contains "friendly" or source URL matches friendlies.
- Default `tier=10` for friendlies.
- If code already exists, warn and offer map instead of creating duplicate.
- Write audit log: `action='create'`, `entity_type='competition'`.
- Revalidate whole batch (competition fix can unblock many rows).

#### `match_existing_club`

- Form fields: `alias`, `club_id`, `competition_code` (optional scoping), `redirect_row_id`.
- Alias defaults to raw import name.
- Add alias via existing `addAlias()`.
- Write audit log: `action='create'`, `entity_type='club_alias'`.
- Revalidate affected row(s). Optionally revalidate all rows with same raw name.

#### `publish_pyramid_club`

- Form fields: `pyramid_club_id`, `redirect_row_id`.
- Requires prerequisites already met: primary venue + division competition mapping.
- Reuse existing publish logic from `app/api/admin/publish/club/route.ts`.
- Write audit log.
- Revalidate affected row(s).

#### `assign_existing_venue`

- Form fields: `venue_id`, `club_id`, `effective_from` (defaults to next July 1st), `redirect_row_id`.
- Assign venue as primary ground for club via existing `assignAdminVenue()`.
- Write audit log.
- Revalidate affected row(s).

#### `create_venue_and_assign`

- Form fields: `name`, `postcode`, `latitude`, `longitude`, `is_approximate`, `coordinate_precision`, `club_id`, `redirect_row_id`.
- Create venue via existing `createAdminVenue()`.
- Assign as primary ground for club.
- Write audit logs for both venue creation and assignment.
- Revalidate affected row(s).

#### `add_club_ticket_info`

- Form fields: `club_id`, `generic_ticket_url`, `sale_mode` (optional), `adult_price_pence` (optional), `concession_price_pence` (optional), `price_source_url` (optional), `verified_at` (defaults to today), `redirect_row_id`.
- Update `clubs.generic_ticket_url` and `clubs.price_source_url`.
- Upsert `club_ticket_prices` if sale mode or prices supplied.
- Write audit log.
- Refresh current row/fixture card.

#### `acknowledge_missing_ticket_info`

- Form fields: `issue_key`, `row_id` (optional), `note` (optional), `redirect_row_id`.
- Write `import_batch_issue_resolutions` row.
- Write audit log for acknowledgement.
- Does not change canonical ticket data.
- Survives revalidation.

#### `edit_row`

- Form fields: any of the raw parsed fields, `row_id`.
- Calls `editAndRevalidateRow()` from foundation layer.
- Write row action metadata.
- Write admin audit log.
- Returns updated row state (blocked/ready).
- If blocked after edit, show current blockers.

#### `import_row`

- Form field: `row_id`.
- Calls `importSingleRow()` from foundation layer.
- Redirect to next unresolved fixture, or to batch top if all resolved.

#### `skip_row`

- Form fields: `row_id`, `reason` (required), `note` (optional, required if reason=other).
- Calls `skipRow()` from foundation layer.
- Redirect to next unresolved fixture.

### 3. Revalidation rules

| Action | Scope |
|--------|-------|
| `create_competition` | Whole batch |
| `match_existing_club` | Affected row(s) |
| `publish_pyramid_club` | Affected row(s) |
| `assign_existing_venue` | Affected row(s) |
| `create_venue_and_assign` | Affected row(s) |
| `add_club_ticket_info` | Current fixture card only |
| `acknowledge_missing_ticket_info` | None (stored separately, survives revalidation) |
| `edit_row` | Affected row only |
| `import_row` | Revalidates row immediately before apply |
| `skip_row` | None (marks final action) |

### 4. Error handling

- Every action validates required fields and returns specific error messages.
- Redirect preserves anchor: `?error=...&anchor=fixture-{rowId}`.
- Bad request data redirects to batch page with error banner.
- Unexpected errors redirect with generic message and logged details.

### 5. Audit log consistency

- All permanent data changes write to `admin_audit_log`.
- Row workflow actions (edit, import, skip) also write to `import_batch_row_actions`.
- Issue acknowledgements write to both.
- Each audit log entry includes `import_batch_id` as contextual metadata.

### 6. Tests

Add to `tests/importResolution.test.ts`:

- Repair endpoint validates CSRF.
- Unknown action returns error.
- Each handler writes canonical changes correctly.
- Each handler writes appropriate audit logs.
- Revalidation scope matches the table above.
- Error handling on missing fields.
- Acknowledge missing ticket info survives full batch revalidation.
- Single-row import from repair endpoint applies one row correctly.
- Skip from repair endpoint marks final action and records reason/note.

## Acceptance Criteria

- Each repair handler writes correct permanent data.
- Each handler writes appropriate audit logs.
- Revalidation scope matches specifications.
- Acknowledge survives revalidation.
- Single import/skip works from the endpoint.
- All existing tests still pass.

## Verification

- `npm run lint`
- `npm run test` — all resolution tests pass.
- `npm run build`
- Manual: curl/HTTPie test key handlers against local dev server.
