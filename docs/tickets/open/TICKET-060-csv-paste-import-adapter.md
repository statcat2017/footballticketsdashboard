# TICKET-060: CSV Paste Fixture Import Adapter

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-059

## Purpose

Let admins paste fixture data as CSV text and have it parsed into a normalized import batch for preview and manual apply.

## Work

- Add `lib/import/adapters/csv.ts`:
  - `parseCsv(csvText: string, columnMapping?: ColumnMapping): NormalizedFixtureRow[]`
  - `createImportBatchFromCsv(db, csvText, sourceId, seasonLabel, actor, columnMapping?)` — parse CSV, create batch, insert rows.
- Implement header detection and auto-mapping:
  - Common column name patterns to recognise: `home`, `away`, `date`, `time`, `kickoff`, `competition`, `division`, `venue`, `ground`, `price`, `ticket`, `source`, `status`.
  - Case-insensitive matching.
  - Strip leading/trailing whitespace from column names and cell values.
  - Do not require a header row — column mapping can be supplied explicitly.
- Handle edge cases:
  - Empty CSV → return empty parse with a clear error.
  - Missing required columns (home, away) → per-row parse error, not batch failure.
  - Rows beyond configured limit → capped with warning.
  - Encoding → accept UTF-8; reject non-UTF-8 or flag encoding issues.
  - Date/time variants → `2026-05-20`, `20/05/2026`, `May 20, 2026`, `20 May 2026` (UK order). Store parsed values in `kickoffDate`/`kickoffTime` and original values in `evidence_json`.
- Store raw CSV text in `import_batches.raw_payload`.
- Record row count per batch.
- D1-safe: all DB writes via `writeBatch()` via the foundation service.

## Acceptance Criteria

- Admin can paste CSV text → adapter creates an import batch with normalized rows.
- Recognised column headers map automatically.
- Rows with unparseable dates are flagged per-row (not batch-level failure).
- Rows with missing home/away are flagged per-row.
- Raw CSV is preserved in the batch record.
- Row count is accurate in batch metadata.

## Verification

- Unit tests for CSV parsing with various column names and date formats.
- Unit tests for auto-mapping and explicit column mapping.
- Unit tests for edge cases: empty CSV, missing columns, encoding.
- Integration test: `createImportBatchFromCsv` produces correct batch + rows.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Sprint: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
- Foundation service: [TICKET-059](./TICKET-059-fixture-import-foundation-service.md)
