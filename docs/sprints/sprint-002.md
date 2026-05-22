# Sprint 2: Fixture Import Pipeline — Preview & Manual Apply

**Status:** Not Started — all 5 tickets (TICKET-059 through TICKET-063) remain in the open backlog

## Goal

Build the first end-to-end fixture import path so an admin can take fixture rows from a CSV paste or a static HTML table URL, normalise them into import batches, validate and match them against existing data, preview grouped outcomes, and manually apply safe rows.

No auto-approval. No agentic scraper. No public search changes. The sprint finishes when an admin can paste fixture data, see clearly what would be created/blocked/warned, and click apply.

## Sprint Scope

| Area | In Scope | Deferred |
|------|----------|----------|
| Import adapters | CSV paste, static HTML table URL (multi-table selection, safe fetch) | API feed, agentic scrape |
| Normalisation | Shared row contract, column mapping for CSV | — |
| Validation | Club/competition/venue matching, date/time rules, assumed-time logic | — |
| Preview | Grouped by current schema outcomes: insert, update, blocked, pending/skip, with warnings shown separately | Full review queue with separate statuses |
| Apply | Manual apply of rows classified as insert/update, fixture insert/update, audit | Auto-approval for trusted sources |
| Admin UI | New-import page, batch detail page, source picker, source creation | Fixture admin CRUD (TICKET-045), public card preview |

## Tickets

| ID | Title | Est. |
|----|-------|------|
| TICKET-059 | Fixture Import Foundation Service | Medium |
| TICKET-060 | CSV Paste Import Adapter | Medium |
| TICKET-061 | Static HTML Table URL Import Adapter | Large |
| TICKET-062 | Fixture Import Validation, Matching & Manual Apply | Large |
| TICKET-063 | Admin Import UI | Medium |

## Dependencies

- **Schema foundation** — `fixture_sources`, `import_batches`, `import_batch_rows`, `fixture_seasons`, `club_mappings`, `division_competition_mappings`, `club_aliases`, one-off participant schema — all deployed (Sprint 1).
- **Mapping/publish layer** — admin can publish clubs and competitions, club/competition resolution exists in `clubMapping.ts` (Sprint 1).
- **Data quality dashboard** — live checks for missing venues, imprecise coords, unmapped clubs, etc. (Sprint 1).

## Key Decisions

- **Batch owns rows from multiple tables** — when an HTML page has multiple fixture tables, all selected tables contribute to one import batch. `evidence_json` stores table index, caption, row index per row.
- **Source auto-creation** — entering a URL creates/looks up a `fixture_sources` row by base URL. CSV paste requires a named source created beforehand (or auto-creates a "manual" source).
- **Preview never writes fixtures** — validation updates import-row outcomes only. The apply action is a separate confirmed step that writes fixtures.
- **Use current row outcome enum** — `match_result` stays aligned with the deployed schema: `insert`, `update`, `skip`, `blocked`, `pending`. Soft warnings live in `warnings_json` and do not create a separate warning state.
- **Apply is per-batch, not per-row** — the apply action processes all rows classified as `insert` or `update` in one batch. Blocked, skipped, or pending rows are skipped with clear reasons.
- **WriteBatch for apply** — fixture insert/update uses `db.writeBatch()` for D1 compatibility.
- **Blank fields never erase** — fixture update logic explicitly checks `undefined` before setting each field.

## Remaining M1 Tickets

| Ticket | Status | Note |
|--------|--------|------|
| TICKET-036 | Schema complete | Service/admin UI tracked in Sprint 2 tickets |
| TICKET-038 | Schema complete | Remaining assumed-time logic in validation service (TICKET-062) |

## Deferred

- `TICKET-042`: Source-agnostic adapter framework — narrowed to CSV + HTML URL for Sprint 2.
- `TICKET-043`: Auto-approval gates — manual apply only this sprint.
- `TICKET-044`: Import review queue — exceptions surface in batch preview but not as status-tracked items.
- `TICKET-045`: Fixture admin CRUD + public card preview — deferred after Sprint 2.
- `TICKET-046`: Public search readiness — depends on import pipeline working first.
- TICKET-047 through TICKET-058: Deferred.

## Acceptance Criteria

- Admin can paste CSV fixture rows → see a preview batch with grouped outcomes.
- Admin can enter a static HTML URL → see detected tables → select one or more → preview grouped outcomes.
- Rows with clear blockers (unmapped club, missing venue, invalid date) are marked `blocked` with a reason.
- Rows with soft warnings (assumed time, missing ticket URL) keep their `insert`/`update` outcome and show warnings separately.
- Admin can confirm apply → safe rows create/update fixtures → batch updates with final actions.
- Blocked rows never write to the fixtures table.
- No import path implicitly creates public clubs or competitions.
- Multi-statement fixture writes use `writeBatch()`. No `db.transaction()` in production paths.
- `npm run lint`, `npm run test`, `npm run build` pass at sprint end.

## Verification

- `npm run lint`
- `npm run test` (service tests for adapters, validation, matching, apply)
- `npm run build`
- Manual: paste CSV → verify preview → apply → verify fixtures created.
- Manual: enter URL → select tables → verify preview → apply → verify fixtures created.
