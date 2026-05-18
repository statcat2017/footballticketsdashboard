# TICKET-059: Fixture Import Foundation Service

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-036 (schema)

## Purpose

Extend the existing `lib/import` service helpers around the `fixture_sources`, `import_batches`, and `import_batch_rows` schema so adapters and the admin UI can create, read, and update import data without adding raw SQL in route handlers.

## Work

- Extend `lib/import/sourceRegistry.ts`:
  - `getOrCreateSource(db, input)` — lookup by source type/name/base URL where available or create a new source row. Returns the source.
  - Keep `listSources(db)`, `getSource(db, id)`, and `updateSource(db, id, updates)` as the shared source-registry API.
- Extend `lib/import/importBatch.ts`:
  - Keep `createBatch(db, input)`, `getBatch(db, batchId)`, `listBatches(db, options)`, `updateBatchStatus(db, batchId, status)`, and `updateBatchCounts(db, batchId, counts)` as the shared batch API.
  - Keep `addBatchRows(db, batchId, rows)` as the bulk row insert helper. It must continue to use `writeBatch()`.
  - Add `getBatchRowsByMatchResult(db, batchId)` — fetch rows grouped by the current schema's `match_result` values for preview display.
  - Add a higher-level `updateBatchRowOutcome(db, rowId, outcome)` wrapper around `updateBatchRow()` for validation/apply code.
- Keep the normalized fixture row contract in `lib/import/types.ts` and extend only where needed:
  ```typescript
  interface NormalizedFixtureRow {
    homeParticipantRaw: string;
    awayParticipantRaw: string;
    homeIsOneOff?: boolean;
    awayIsOneOff?: boolean;
    competitionRaw?: string;
    venueRaw?: string;
    kickoffDate?: string;
    kickoffTime?: string;
    status?: FixtureStatus;
    ticketUrl?: string;
    adultPricePence?: number;
    concessionPricePence?: number;
    sourceUrl?: string;
    evidence?: Record<string, unknown>;
    confidence?: Confidence;
  }
  ```
- Ensure multi-row or multi-statement writes go through `db.writeBatch()`. No `db.transaction()` in production paths.
- Add unit tests for each helper covering creation, lookup, and batch insert.

## Acceptance Criteria

- Admin UI or adapter code can create a fixture source by name.
- Admin UI or adapter code can create an import batch linked to a source.
- Admin UI or adapter code can insert normalized rows into a batch.
- Rows are queryable by match outcome for preview grouping.
- Multi-row inserts work via `writeBatch()` and no production path uses `db.transaction()`.

## Verification

- Unit tests for source creation and lookup.
- Unit tests for batch creation and row insertion.
- Unit tests for row outcome queries.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Sprint: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
- Schema: [lib/db/schema.ts](../../../lib/db/schema.ts)
