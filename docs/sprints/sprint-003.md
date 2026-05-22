# Sprint 3: Import Batch Resolution — Fixture-by-Fixture Repair & Apply

**Status:** Not Started — depends on Sprint 2 completion; all 3 tickets (TICKET-064 through TICKET-066) remain in the open backlog

## Goal

Enable an admin to resolve every common import blocker — unknown competition, unknown club, missing venue, missing ticket info — without leaving the batch detail screen. Deliver a fixture-by-fixture resolution queue where each blocked/ready row is a card, each issue has an inline single-purpose repair form, and each fixture can be imported individually once unblocked.

No changes to public pages. No auto-approval. No new ingestion adapters.

## Sprint Scope

| Area | In Scope | Deferred |
|------|----------|----------|
| Data model | Structured issue codes, issue resolution table, row action table, single-row helpers | — |
| Repair backend | One explicit repair endpoint with 10 action handlers, audit logging, revalidation | — |
| Batch UI | Fixture queue with needs-resolution, ready, imported, skipped sections; inline repair forms | Search/autocomplete for club/venue (v1 remains plain selects) |
| Club creation | Create alias, publish existing pyramid club | Brand-new club + pyramid membership creation |
| Ticket handling | Add club ticket info, batch-only acknowledgement | — |
| Apply | Single-fixture import with immediate revalidation; bulk import still available | — |

## Tickets

| ID | Title | Est. |
|----|-------|------|
| TICKET-064 | Import Batch Resolution Foundation | Large |
| TICKET-065 | Import Batch Repair Endpoints | Medium |
| TICKET-066 | Fixture-by-Fixture Resolution Queue UI | Large |

## Dependencies

- **Import pipeline sprint (Sprint 2)** — `import_batches`, `import_batch_rows`, validation, matching, apply, admin import UI — all deployed.
- **Publish/mapping layer** — club aliases, competition publishing, venue assignment, club mapping — all exist from earlier sprints.

## Key Decisions

### Data model
- Structured warning issues use typed codes (e.g. `unknown_competition`, `unknown_club`), with `messages` array preserved for backward compatibility.
- `import_batch_issue_resolutions` stores batch-only acknowledgements by `issue_key` (optionally scoped to `row_id`).
- `import_batch_row_actions` stores row workflow history: imports, skips, edits.
- Both new tables have indexes on `batch_id` and `row_id`.

### Repair design
- One explicit `POST /api/admin/imports/{batchId}/repairs` endpoint with `_action` dispatch.
- All permanent repairs write canonical data + audit logs.
- Revalidation scope depends on action type:
  - Competition fix: whole batch.
  - Club/venue/row fix: affected row(s).
  - Single import: revalidates row immediately before apply.
- Delete stays in existing `DELETE` path (PR #112 scope), not in repairs.

### UI design
- Fixture-by-fixture cards, not grouped by outcome.
- Sections in order: Needs resolution, Ready to import, Imported (collapsed), Skipped (collapsed).
- Inline `<details>` repair forms, not modals or drawers.
- Plain `<select>` lists for v1; search/autocomplete deferred.
- After import/skip, redirect to next unresolved fixture.
- Bulk `Import all ready fixtures` kept as secondary action.

### Scope boundaries
- Brand-new club creation deferred (requires pyramid membership, division selection, etc.).
- `Punjab United` style resolution: match existing → publish pyramid club → defer creation.
- Ticket info acknowledgement is batch-only, survives revalidation, stays visible as resolved/collapsed.

## Acceptance Criteria

- Admin can resolve each blocker type from the batch screen without navigating away.
- `Import this fixture` applies only that row, revalidating before apply.
- `Skip this fixture` marks final action with reason, moves to next row.
- Repairs write permanent data changes and audit logs.
- Batch-only acknowledgements survive revalidation.
- Partially approved batches remain editable for active rows.
- Fully approved batches reject further actions.
- Existing bulk import still works.
- `npm run lint`, `npm run test`, `npm run build` pass.

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual: import Non-League Friendlies URL → resolve issues per fixture → import individually → verify.
- Manual: skip unwanted fixtures → verify batch completes.
