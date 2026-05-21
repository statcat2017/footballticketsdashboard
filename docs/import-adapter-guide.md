# Import Adapter Guide

This guide explains how to add fixture import adapters without duplicating validation, fixture identity, or apply logic.

The current adapters live in `lib/import/adapters/` and expose concrete helper functions such as `createImportBatchFromCsv()` and `createImportBatchFromHtmlUrl()`. If a shared adapter interface lands later, keep the same boundaries described here: adapters parse source payloads into normalized rows and hand those rows to the import batch pipeline.

## Adapter Responsibility

An adapter should do only source-specific work:

- Fetch or receive the source payload, applying source-specific safety rules where needed.
- Parse source records into `NormalizedFixtureRow[]` from `lib/import/types.ts`.
- Preserve raw source context in `evidence` so admins can explain or repair a row later.
- Create a batch with `createBatch()` and insert rows with `addBatchRows()`.
- Update batch counts and parse status with `updateBatchCounts()` and `updateBatchStatus()`.

Adapters should not resolve clubs, competitions, venues, duplicates, or fixture updates themselves. They should also avoid writing raw SQL except where a source adapter genuinely needs source-specific persistence that is not covered by existing helpers.

## Normalized Rows

Every adapter should parse into the shared `NormalizedFixtureRow` shape:

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

Required adapter output is deliberately small: `homeParticipantRaw` and `awayParticipantRaw` identify the participants as supplied by the source. Everything else is optional source evidence or parsed detail.

Prefer these conventions:

- Store dates as `YYYY-MM-DD` when the adapter can parse them confidently; preserve the original text in `evidence`.
- Store times as `HH:mm` when the adapter can parse them confidently; leave assumptions to validation.
- Store prices in pence only when parseable as positive integers.
- Set `sourceUrl` to the source page or row-level evidence URL when available.
- Set one-off flags only when the source or admin action explicitly identifies a one-off participant.
- Include source-specific proof in `evidence`, such as original cells, headers, source URL, table index, row index, API IDs, confidence signals, or scrape metadata.

## Batch Creation Flow

Adapters should follow the existing helper pattern:

1. Parse the payload into `NormalizedFixtureRow[]` plus per-row parse errors.
2. Create or receive a `fixture_sources` row. Use `getOrCreateSource()` when the adapter can infer the source from a URL or feed identity.
3. Call `createBatch(db, { sourceId, adapterType, actor, rawPayload, seasonLabel })`.
4. Call `addBatchRows(db, batch.id, rows.map((row, i) => ({ rowIndex: i, row })))`.
5. Call `updateBatchCounts()` with total rows, failed parse count, and parse errors.
6. Call `updateBatchStatus()` to move successful parses to `parseStatus: "parsed"` and `approvalStatus: "preview"`.

`addBatchRows()` is the boundary that maps normalized rows onto `import_batch_rows` and performs the bulk insert safely. Multi-row writes should continue to use the foundation helpers rather than adapter-local transaction code.

## Centralized Fixture Identity

Do not duplicate fixture identity SQL in adapters.

Existing fixture matching is centralized in `findImportFixtureMatch()` in `lib/import/fixtureIdentity.ts`. Validation, apply, and single-row resolution call this helper after raw adapter rows have been resolved into concrete clubs, one-off participants, competition code, venue, and normalized date/time.

The current identity rules are:

- Mapped clubs match on `home_club_id`, `away_club_id`, `competition_code`, and `season_label`.
- One-off participants match on their one-off names, side, `competition_code`, and `season_label`.
- Mapped-club matches include `fixture_date` when the resolved row has a kickoff date.
- Multiple fixture matches return an ambiguous result instead of guessing.

Keeping this logic centralized gives all adapters the same insert/update decision, duplicate handling, one-off behaviour, ambiguity handling, and stale-update protection. It also keeps later identity changes, such as source IDs or revised date rules, in one place.

## Validation And Apply Boundary

Adapters stop after batch creation. The import workflow then handles:

- `validateRow()` / batch validation for club, alias, competition, venue, date, time, URL, status, warning, and blocker checks.
- `findImportFixtureMatch()` for existing fixture identity.
- `applyBatchRows()` or single-row import helpers for actual fixture inserts and updates.
- Audit logging and final row outcome updates.

This split keeps source parsing deterministic and prevents adapter-specific differences in production fixture identity. When adding an adapter, test that it produces the expected normalized rows and batch records; test fixture identity through validation/apply tests instead of embedding identity assertions in adapter code.

## Adding A New Adapter

Use this checklist:

- Add source-specific parsing under `lib/import/adapters/`.
- Return `NormalizedFixtureRow[]` and structured parse errors.
- Reuse existing parsing helpers where practical, such as CSV date, time, status, and price parsing.
- Preserve source evidence in each row.
- Use `getOrCreateSource()`, `createBatch()`, `addBatchRows()`, `updateBatchCounts()`, and `updateBatchStatus()`.
- Let validation/apply call `findImportFixtureMatch()`; do not query `fixtures` from adapter code for identity decisions.
- Add parser and batch-creation tests for the adapter.
- Add validation/apply tests only when the new source exposes identity edge cases not already covered.
