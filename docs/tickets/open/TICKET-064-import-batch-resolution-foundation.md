# TICKET-064: Import Batch Resolution Foundation

Status: open
Owner:
Priority: high
Depends on: TICKET-062, TICKET-063

## Purpose

Add the backend data model and single-row helpers needed for the import batch resolution workflow. This is Phase 1, covering migrations, structured issue codes, issue resolution table, row action table, one-row validation/apply/skip/edit helpers, and updated bulk-apply semantics. No visible UI changes — the existing batch page keeps working.

## Work

### 1. Structured issue codes

Add issue code enum and structured JSON format for batch row warnings:

```typescript
type IssueCode =
  | "unknown_competition"
  | "unknown_club"
  | "missing_primary_venue"
  | "missing_ticket_info"
  | "venue_not_found"
  | "ambiguous_club"
  | "invalid_date"
  | "invalid_time"
  | "assumed_time"
  | "invalid_status"
  | "invalid_source_url"
  | "invalid_ticket_url"
  | "venue_unusable_coords"
  | "one_off_needs_venue"
  | "missing_date";

type WarningIssue = {
  code: IssueCode;
  field?: string;
  rawValue?: string;
  severity: "blocker" | "warning";
  message: string;
  issueKey: string; // stable grouping key, e.g. "unknown_competition:non-league friendlies"
};
```

- `warnings_json` payload becomes `{ issues: WarningIssue[], messages: string[] }` for backward compatibility.
- `validateRow()` produces structured issues instead of only string messages.
- `messages` is always derived from `issues.map(i => i.message)`.
- Existing UI that reads `warningsJson.messages` continues to work.

### 2. New migrations

Add `import_batch_issue_resolutions` table:

```sql
CREATE TABLE IF NOT EXISTS import_batch_issue_resolutions (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_id INTEGER,
  issue_code TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  resolution_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ibr_batch ON import_batch_issue_resolutions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibr_row ON import_batch_issue_resolutions(row_id);
```

Add `import_batch_row_actions` table:

```sql
CREATE TABLE IF NOT EXISTS import_batch_row_actions (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_id INTEGER NOT NULL REFERENCES import_batch_rows(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'import_insert', 'import_update', 'skip', 'edit_row'
  )),
  reason TEXT,
  note TEXT,
  actor TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ibra_batch ON import_batch_row_actions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibra_row ON import_batch_row_actions(row_id);
```

### 3. Single-row helpers

Add new functions in `lib/import/`:

- `validateRowById(db, rowId): Promise<ImportBatchRow>`
  - Fetch one row, run `validateRow()`, update outcome, return updated row.
  - Used directly for single-row revalidation.

- `editAndRevalidateRow(db, rowId, edits, actor): Promise<ImportBatchRow>`
  - `edits` allows updating raw parsed fields:
    - `homeParticipantRaw`, `awayParticipantRaw`,
    - `competitionRaw`, `venueRaw`,
    - `kickoffDate`, `kickoffTime`, `status`,
    - `ticketUrl`, `sourceUrl`.
  - Block edits if `final_action` is set (read-only).
  - Update raw fields on `import_batch_rows`.
  - Write row action `edit_row` with `metadata_json` recording changed fields.
  - Write admin audit log for row edit.
  - Call `validateRowById()` and return updated row.

- `importSingleRow(db, rowId, actor): Promise<ImportBatchRow>`
  - Block if `final_action` is set.
  - Revalidate row immediately.
  - If still blocked, return row with current blockers (do not apply).
  - If `insert` or `update`, call apply logic for this row only (reuse `buildFixtureInsert` / `buildFixtureUpdate`).
  - Record `final_action` and `final_fixture_id` on row.
  - Write row action `import_insert` or `import_update`.
  - Write fixture audit log.
  - If all batch rows are finalized, set `approval_status='approved'`.
  - Otherwise set `approval_status='partially_approved'`.

- `skipRow(db, rowId, reason, note, actor): Promise<ImportBatchRow>`
  - Block if `final_action` is set.
  - Set row `match_result='skip'`, `final_action='skip'`.
  - Write row action `skip` with reason and optional note.
  - Update batch approval status if all rows finalized.

### 4. Updated bulk-apply semantics

- `applyBatchRows()` guard changes from `approvalStatus === "approved" || approvalStatus === "partially_approved"`
  to `approvalStatus === "approved"` only.
- `partially_approved` batches remain editable/importable.
- Active rows (no `final_action`) are still processed by bulk apply.
- Finalized rows are ignored by bulk apply.

### 5. Issue acknowledgement

- `acknowledgeBatchIssue(db, batchId, issueKey, actor, opts?)`:
  - `opts.rowId` for row-specific acknowledgement.
  - `opts.note` optional.
  - Insert into `import_batch_issue_resolutions`.
  - Write admin audit log for resolution.
  - If `rowId` is set, issued for that single row.
  - If not, applies to all rows in the batch with that issue key.

- `getActiveIssuesForBatch(db, batchId)`: returns unresolved issues after subtracting acknowledged ones.

### 6. Tests

New file `tests/importResolution.test.ts`:

- Structured issue payloads include both `issues` and `messages` arrays.
- Single-row validation updates only that row's outcome.
- Row edit updates raw fields, logs row action, logs audit, revalidates.
- Blocked row edit refuses if `final_action` is set.
- Single-row import revalidates first, blocks if still blocked.
- Single-row import applies insert and records fixture ID.
- Single-row import applies update and records fixture ID.
- Skip sets `final_action='skip'` and logs reason/note.
- Skip blocks if `final_action` is already set.
- Partially approved batches can still process active rows.
- Fully approved batches reject further apply/edit/import.
- Issue acknowledgement inserts resolution row when keyed to batch.
- Issue acknowledgement inserts resolution row when keyed to row.
- `getActiveIssuesForBatch` excludes acknowledged issues.
- Row action table records all action types.

## Acceptance Criteria

- Existing batch page works unchanged.
- Existing bulk apply works with both `pending` and `partially_approved` batches.
- Single-row helpers exist and have passing tests.
- Issue acknowledgement survives revalidation.
- Row edits are traceable via action history and audit log.
- `npm run lint`, `npm run test`, `npm run build` pass.

## Verification

- `npm run lint`
- `npm run test` — new resolution tests pass alongside existing tests.
- `npm run build`
- Manual: existing batch page looks/works same as before.
