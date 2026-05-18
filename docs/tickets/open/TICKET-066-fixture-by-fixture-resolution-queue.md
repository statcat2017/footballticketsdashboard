# TICKET-066: Fixture-by-Fixture Resolution Queue UI

Status: open
Owner:
Priority: high
Depends on: TICKET-064, TICKET-065

## Purpose

Refactor the batch detail page (`/admin/imports/[id]`) from grouped-row sections to a fixture-by-fixture resolution queue with inline repair forms. This is Phase 3: the frontend that ties the foundation and repair endpoints into a usable workflow.

## Work

### 1. Page layout redesign

Replace the current grouped-rows layout with sections ordered by action needed:

#### Needs resolution (top)

Fixture cards for rows with `match_result='blocked'` and no `final_action`.

Each card shows:

- **Header:** home vs away, date, time.
- **Current data block:** competition, venue, home club, away club — with resolved IDs where available, raw names where not.
- **Warnings/blockers list:** structured issues with severity icons.
- **Inline repair forms** (expanded as needed — see §3 below).

#### Ready to import

Fixture cards for rows with `match_result='insert'` or `'update'` and no `final_action`.

Each card shows:

- **Header:** home vs away, date, time, competition.
- **Resolved entities:** club names, venue name, competition.
- **Warning badges:** ticket info missing, assumed time, etc.
- **Actions:**
  - `Import this fixture` button.
  - `Skip this fixture` button (opens skip reason form).
  - `Edit row` button (expands parsed-fields form).

#### Imported

Collapsed `<details>` section showing read-only history of `final_action='insert'` or `'update'` rows.

Each row shows:

- home vs away, date, time, competition, venue, fixture ID.
- `Imported by {actor} at {timestamp}` from row action history.
- Skip to button to view the fixture on the admin fixture page (future).

#### Skipped

Collapsed `<details>` section showing read-only history of `final_action='skip'` rows.

Each row shows:

- home vs away, date.
- Skipped by {actor} at {timestamp}. Reason: {reason}. Note: {note}.

### 2. Batch summary bar

Between header and sections, show a compact summary:

```
3 need resolution · 8 ready to import · 5 imported · 2 skipped
```

Color indicators per count. Collapsible/responsive.

### 3. Inline repair forms

Each form is an expanded `<details>` inside the fixture card. Single-purpose, expanded by clicking a `Fix` link.

#### Create competition

- Auto-filled: name from raw competition, kind=friendly if applicable, tier=10.
- Fields: code (editable), name, kind select, tier number.
- Buttons: `Create & revalidate batch` | `Cancel`.

#### Match existing club

- Auto-filled: alias = raw club name, competition scope = resolved competition.
- Fields: club `<select>` of all public clubs, alias text, scope select (with global option).
- Buttons: `Add alias & revalidate` | `Cancel`.

#### Publish pyramid club

- Shows: pyramid club name, status, prerequisite check results.
- If prerequisites met: one `Publish club` button.
- If prerequisites missing: show what's needed with links.
- Buttons: `Publish club` | `Cancel`.

#### Assign existing venue

- Field: venue `<select>` of all venues.
- Auto-filled: effective_from = next July 1st.
- Buttons: `Assign venue & revalidate` | `Cancel`.

#### Create venue and assign

- Fields: name, postcode, latitude, longitude, is_approximate checkbox, coordinate_precision select.
- Hidden: club_id for auto-assignment.
- Buttons: `Create venue, assign & revalidate` | `Cancel`.

#### Add club ticket info

- Auto-filled: club name read-only, verified_at = today.
- Fields: generic_ticket_url (required), sale_mode select, adult_price_pence, concession_price_pence, price_source_url.
- Buttons: `Save ticket info` | `Cancel`.

#### Acknowledge missing ticket info

- Shows: alert that this is batch-only, not a permanent fix.
- Fields: optional note.
- Buttons: `Acknowledge for this batch` | `Cancel`.

#### Edit row

- Fields: kickoffDate, kickoffTime, status, competitionRaw, homeParticipantRaw, awayParticipantRaw, venueRaw, ticketUrl, sourceUrl.
- Buttons: `Save & revalidate` | `Cancel`.

#### Skip fixture

- Reason: fixed dropdown (`duplicate`, `bad_source_row`, `not_relevant`, `needs_later_review`, `other`).
- Note: optional textarea (required if reason=other).
- Buttons: `Skip fixture` | `Cancel`.

### 4. Action flows

#### Import this fixture

1. User clicks `Import this fixture`.
2. POST to `/api/admin/imports/{batchId}/repairs` with `_action=import_row&row_id=...`.
3. Server revalidates row, applies if ready.
4. Redirect to next unresolved fixture (`#fixture-{nextRowId}`), or batch top if done.
5. If still blocked: redirect back to same card with error banner.

#### Skip this fixture

1. User selects reason, optionally adds note.
2. POST to repair endpoint with `_action=skip_row`.
3. Redirect to next unresolved fixture.
4. Skipped row appears in collapsed Skipped section.

#### After repair

1. Form POST to repair endpoint.
2. Server applies permanent fix, writes audit log, revalidates.
3. Redirect back to same fixture card anchor.
4. Card re-renders with updated state.
5. If row is now ready: `Import this fixture` becomes available.
6. If row remains blocked: updated warnings/blockers shown.

### 5. Bulk action

Keep a secondary bulk action button:

`Import all ready fixtures` — smaller, less prominent than per-fixture buttons.

- Confirm checkbox.
- Applies only rows currently `insert` or `update` with no `final_action`.
- Revalidates each row before applying.
- Skips rows that become blocked during pre-apply check.
- Redirects to batch page with result summary.

### 6. CSRF and auth

- CSRF token per page, same as existing admin flow.
- All form POSTs include CSRF token.
- Session check on every request.

### 7. Styling

- Match existing admin inlined styles (no CSS framework).
- Use same color palette: green for ready/imported, red for blocked, amber for warnings, grey for skipped.
- Use `<details>`/`<summary>` for collapsible repair forms.
- Responsive layout for fixture cards.

### 8. Navigation

- Back link to `/admin/imports`.
- Badge counts on each section header.
- No pagination for v1 (batches are typically ≤100 rows).

## Acceptance Criteria

- Blocked fixtures show inline repair forms grouped by issue.
- `Import this fixture` applies one row and moves to next unresolved.
- `Skip this fixture` marks final action and moves to next.
- Repairs write permanent data, audit logs, and refresh card state.
- Batch-only acknowledgement survives revalidation.
- Bulk `Import all ready fixtures` still works.
- Imported/skipped rows are read-only in collapsed history.
- `npm run lint`, `npm run test`, `npm run build` pass.

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual: create import batch → fix issues per fixture → import → verify.
- Manual: skip fixtures → verify batch completes when all rows finalized.
