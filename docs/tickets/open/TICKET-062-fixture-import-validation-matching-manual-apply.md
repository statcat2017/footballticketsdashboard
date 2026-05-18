# TICKET-062: Fixture Import Validation, Matching & Manual Apply

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-059, TICKET-060, TICKET-061

## Purpose

Validate normalized import rows against existing club mappings, aliases, competitions, venues, and date constraints. Produce actionable outcomes for preview. Apply safe rows on admin confirmation.

## Work

### Validation & Matching Service

Add `lib/import/validation.ts`:

**Club resolution** — for each home/away participant:
- Match via canonical public club name.
- Match via pyramid club name through existing mapping.
- Match via scoped/unscoped alias using `clubMapping.ts` `resolveFixtureParticipant()`.
- If matched → store `home_participant_resolved_id` / `away_participant_resolved_id`.
- If unmatched → `match_result = 'blocked'`, warning: "Unknown club. Verify the club name or add an alias."
- If ambiguous (multiple matches) → `match_result = 'blocked'`, warning: "Ambiguous alias matches N clubs." The full review queue can introduce a separate review state later.

**Competition resolution:**
- Match `competitionRaw` against `competitions.code` or `competitions.name`.
- If no match → try `resolveCompetitionFromFixture()` to infer from home club's competition.
- If still unmatched → `blocked`, warning: "Unknown competition. Publish the division first."

**Venue resolution:**
- If `venueRaw` is provided → match by venue name. If no match → try home club's primary venue.
- If no venueRaw and home club is a one-off → `blocked`, warning: "One-off home participant needs an explicit venue."
- If home club has no primary venue → `blocked`, warning: "Home club has no primary venue."
- If venue has unusable coordinates → add a warning, recommended action: "Fix venue coordinates."
- If venue matched → store `venue_resolved_id`.

**Date/time validation:**
- Validate `kickoffDate` for `fixture_date`. Support UK format (DD/MM/YYYY) and ISO format (YYYY-MM-DD) at adapter boundaries. Invalid dates → `blocked`.
- Validate `kickoffTime` for `kickoff_time` if present. Invalid times → `blocked`.
- If `kickoffTime` is blank:
  - Weekend → assume `15:00`, `kickoff_time_status = 'assumed'`, `warning`: "Kickoff time assumed 15:00 (weekend)."
  - Weekday → assume `19:45`, `kickoff_time_status = 'assumed'`, `warning`: "Kickoff time assumed 19:45 (midweek)."
  - UK local interpretation: Saturday/Sunday = weekend, Monday–Friday = weekday.

**Status validation:**
- Validate parsed status against allowed values: `scheduled`, `postponed`, `cancelled`, `finished`, `unknown`. Invalid or unmapped source status → default to `scheduled` with warning.

**Ticket fields:**
- Parsed ticket URL → store as `ticket_url` on the import row.
- Source/evidence URL for the fixture page → store as `source_url` on the import row and fixture.
- `adultPricePence`, `concessionPricePence` → store if parseable as positive integers. Applying fixture-level price overrides is deferred unless the implementation explicitly writes `fixture_ticket_price_overrides`.
- Missing ticket info → `warning`: "No ticket information provided."

**Outcome classification:**
Use the current `import_batch_rows.match_result` schema values:
- `insert` — structural checks pass and no existing fixture identity is found. The row can be applied as a new fixture.
- `update` — structural checks pass and an existing fixture identity is found. The row can be applied as an update.
- `skip` — valid row intentionally not applied, for example duplicate data that does not change anything.
- `blocked` — one or more structural failures, including ambiguous matches until the full review queue exists.
- `pending` — initial state before validation.

Soft warnings, such as assumed kickoff time or missing ticket info, are stored in `warnings_json` and do not change an `insert` or `update` outcome.

### Fixture Identity & Apply

Add `lib/import/apply.ts`:

**Fixture identity:**
- Look up existing fixture by `(home_participant, away_participant, competition, season)`.
- Use `(home_club_id, away_club_id, competition_code, season_label)` for mapped clubs.
- For one-off participants, use `(home_one_off_name, away_one_off_name, competition_code, season_label)`.
- If match found → validation marks the row `update` and apply updates the existing fixture.
- If no match → validation marks the row `insert` and apply inserts a new fixture.

**Update rules:**
- Only overwrite fields that are explicitly provided (not null/undefined in import row).
- Never overwrite `admin_updated_at` — that is for manual admin edits only.
- Record fixture identity before/after in `import_batch_rows.warnings_json`.

**Apply action:**
- `applyBatchRows(db, batchId): ApplyResult`
- Process all rows with `match_result IN ('insert', 'update')`.
- Skip rows with `blocked`, `skip`, or `pending` — include skip count in result summary.
- Use `db.writeBatch()` per batch of inserts/updates.
- After apply, update each row's `final_action` (`insert`, `update`, `skip`) and `final_fixture_id`.
- Update batch `approval_status` to `approved` when all non-blocked rows were applied, or `partially_approved` when some rows remain blocked/skipped/pending, and update row counts.

**Audit:**
- Log fixture inserts/updates to `admin_audit_log` using `buildAdminAuditLogWrite()`.
- Log the batch apply action itself (entity type: `import_batch`, action: `apply`).

## Acceptance Criteria

- New matched rows with complete data → `insert`.
- Existing matched rows with complete data → `update`.
- Unmatched club → `blocked` with clear reason.
- Ambiguous alias → `blocked` with club names listed.
- Unmatched competition → `blocked` with publish redirect suggestion.
- Missing venue for one-off home team → `blocked`.
- Missing date → `blocked`. Invalid date → `blocked`.
- Assumed time → warning in `warnings_json` + correct standard assumption (15:00 weekend, 19:45 midweek).
- Apply action creates/updates fixtures only for `insert`/`update` rows.
- Blank import fields never erase existing fixture data.
- Fixture updates record before/after in warnings.
- Apply uses `writeBatch()`. No `db.transaction()`.
- Apply result summary includes insert/update/skip/blocked counts.

## Verification

- Unit tests for each validation rule (club match, venue, date/time, competition, status, ticket).
- Unit tests for assumed-time logic (weekend vs weekday boundary cases).
- Unit tests for fixture identity lookup (mapped clubs, one-off teams).
- Unit tests for apply: insert new, update existing, skip blocked, skip pending/skip rows.
- Unit tests for blank-field preservation on update.
- Integration test: import batch → validate → apply → verify fixture table.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Sprint: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
- Foundation service: [TICKET-059](./TICKET-059-fixture-import-foundation-service.md)
