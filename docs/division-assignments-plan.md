# Division Assignments MVP

Replace the current pyramid_season_memberships / pyramid_season_divisions layer with a single `division_assignments` table that answers "where is each club right now?" No history, no season-transition machinery, no promotion/relegation modelling.

---

## Data Model

### New table: `division_assignments`

```sql
CREATE TABLE IF NOT EXISTS division_assignments (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  admin_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`UNIQUE (club_id)` enforces one current division per club. No season_id — MVP only cares where a club is now.

### Existing tables that remain unchanged

| Table | Role |
|---|---|
| `pyramid_divisions` | Fixed pyramid structure (levels, names, max_size) |
| `competitions` | Public fixture/search competition records |
| `division_competition_mappings` | Optional mapping from pyramid division to public competition |
| `clubs` | Club records |

### Existing tables that are de-emphasised for this workflow

| Table | MVP Treatment |
|---|---|
| `pyramid_season_divisions` | Not used by admin assignment screen |
| `pyramid_season_memberships` | Backfilled into `division_assignments`, then not used by admin screen |
| `pyramid_movements` | Not used |
| `clubs.competition_code` | Cleared on assign/move/unassign to keep public projection consistent |

---

## Migration: Backfill

1. Add `division_assignments` table.
2. Populate from current latest-season data via a script:

```sql
INSERT INTO division_assignments (club_id, division_id, admin_updated_at, created_at)
SELECT
  psm.club_id,
  d.id AS division_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM pyramid_season_memberships psm
JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
JOIN pyramid_divisions d ON d.id = psd.division_id
WHERE psm.season_id = (SELECT id FROM pyramid_seasons ORDER BY id DESC LIMIT 1);
```

3. Do not delete old tables yet. Leave them for reference and potential rollback.
4. The admin assignment screen now reads from `division_assignments`.

---

## Deep Module: `DivisionAssignments`

### Location
`lib/admin/divisionAssignments.ts`

### Interface

```ts
export async function getDivisionAssignments(db: AppDatabase): Promise<DivisionAssignmentViewData>

export async function assignClubToDivision(
  db: AppDatabase,
  clubId: number,
  divisionId: number,
  actor: string
): Promise<{ warning?: string }>

export async function moveClubToDivision(
  db: AppDatabase,
  clubId: number,
  targetDivisionId: number,
  actor: string
): Promise<{ warning?: string }>

export async function unassignClub(
  db: AppDatabase,
  clubId: number,
  actor: string
): Promise<void>
```

### Return type for reads

```ts
DivisionAssignmentViewData {
  seasonLabel: string
  divisions: DivisionGroup[]
  unassignedClubs: UnassignedClub[]
}

DivisionGroup {
  id: number           // pyramid_divisions.id
  name: string
  level: number
  maxSize: number
  displayOrder: number | null
  competitionCode: string | null   // from division_competition_mappings
  isPublished: boolean              // whether a public competition mapping exists
  clubs: DivisionAssignedClub[]
  clubCount: number
}

DivisionAssignedClub {
  id: number
  name: string
  status: string
  venueName: string | null
  hasTicketUrl: boolean
  isPublished: boolean
}

UnassignedClub {
  id: number
  name: string
  status: string
  venueName: string | null
}
```

### Behaviour

**`assignClubToDivision`**
- If club already has a `division_assignments` row, updates the `division_id` (effectively moves it).
- If no row exists, inserts one.
- Sets `admin_updated_at`.
- Clears `clubs.competition_code` on the club to avoid stale public projection.
- Does not change `clubs.status`.
- Checks target division `max_size`. If current club count >= max_size, operation succeeds but returns `{ warning: "Division is at capacity." }`.
- Writes `admin_audit_log`.

**`moveClubToDivision`**
- Same implementation as `assignClubToDivision`. Provided as a clearer semantic for UI context.

**`unassignClub`**
- Deletes the `division_assignments` row.
- Clears `clubs.competition_code`.
- Writes `admin_audit_log`.

### Read query

```sql
SELECT
  d.id,
  d.name,
  d.level,
  d.max_size,
  d.display_order,
  dcm.competition_code,
  CASE WHEN dcm.id IS NOT NULL THEN 1 ELSE 0 END AS is_published,
  da.club_id,
  c.name AS club_name,
  c.status AS club_status,
  v.name AS venue_name,
  c.generic_ticket_url,
  c.competition_code AS club_competition_code
FROM pyramid_divisions d
LEFT JOIN division_assignments da ON da.division_id = d.id
LEFT JOIN clubs c ON c.id = da.club_id
LEFT JOIN club_venue_assignments cva
  ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
LEFT JOIN venues v ON v.id = cva.venue_id
LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
ORDER BY d.level, d.display_order, c.name
```

Unassigned clubs query:

```sql
SELECT c.id, c.name, c.status, v.name AS venue_name
FROM clubs c
LEFT JOIN division_assignments da ON da.club_id = c.id
LEFT JOIN club_venue_assignments cva
  ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
LEFT JOIN venues v ON v.id = cva.venue_id
WHERE da.id IS NULL
ORDER BY c.name
```

---

## Admin Screen

### Route
Keep `/admin/publish` as the route for now. Page title changes to `Division Assignments`.

### Read model source
Change `getAllCompetitionsWithClubs()` → `getDivisionAssignments()`. The page no longer starts from `competitions`.

### What the screen shows

```txt
Division Assignments — Season 2025-26

Tier 1
  Premier League (20/20 clubs, Published as PL)   [Assign club] [Un/publish]

Tier 5
  National League (24/24 clubs, Published as NL)  [Assign club] [Un/publish]

Tier 9
  Combined Counties League Premier Division North  (0/20 clubs, Not published) [Assign club] [Publish]
  NWCFL Premier Division                           (18/24 clubs, Not published) [Assign club] [Publish]

Tier 10
  Combined Counties League Division One            (0/20 clubs, Not published) [Assign club] [Publish]
  Western League Division One                      (14/20 clubs, Not published) [Assign club] [Publish]

Unassigned clubs (12)
  Club name ... [Assign]
```

### Collapsed summary per division
- Division name
- Tier level
- Club count / max size
- Competition mapping status badge

### Expanded section per division
- Table of assigned clubs with:
  - Club name (link to detail)
  - Status badge
  - Venue
  - Ticket URL status
  - Published status (public projection)
  - Move button
  - Unassign button
- "Assign club" form at division level:
  - Club select dropdown
  - Assign button

### Publish actions
- "Publish competition" button (existing) — visible when no mapping exists.
- "Publish all ready clubs" button — visible when mapping exists.
- Left unchanged from current implementation.

### Unassigned clubs section
- Table of clubs without a `division_assignments` row.
- Each row has an "Assign" action.
- Links to club detail page.

---

## API Routes

### Existing routes that remain unchanged

| Route | Purpose |
|---|---|
| `POST /api/admin/publish/competition` | Create division_competition_mapping |
| `POST /api/admin/publish/clubs` | Bulk publish clubs in a mapped division |
| `POST /api/admin/publish/club` | Publish a single club |

### New routes

**`POST /api/admin/assign-club`**

```txt
Form fields:
  club_id     (required, positive integer)
  division_id (required, positive integer)
  csrf        (required)

Success: redirect back to /admin/publish
Error:   redirect with error message query param
```

- Validates club exists.
- Validates division exists.
- Calls `assignClubToDivision()`.
- Returns `warning` if division at capacity.

**`POST /api/admin/move-club`**

Same as assign-club. Semantic alias.

**`POST /api/admin/unassign-club`**

```txt
Form fields:
  club_id (required, positive integer)
  csrf    (required)
```

- Validates club exists.
- Calls `unassignClub()`.

---

## Admin Screen UI Changes

### Updated page structure

The page template (`app/admin/publish/page.tsx`) changes:

- Title from "Clubs & Divisions" to "Division Assignments"
- Data source from `getAllCompetitionsWithClubs()` to `getDivisionAssignments()`
- Remove the `competition-screen` mental model; start from pyramid divisions
- Add "Assign club" form per division
- Add "Move" and "Unassign" buttons on club rows
- Add over-capacity warning display

### Form components

All forms should be plain HTML forms (no JS required).

**Assign club form:**
```html
<form method="post" action="/api/admin/assign-club">
  <input type="hidden" name="csrf" value={csrfToken} />
  <input type="hidden" name="division_id" value={division.id} />
  <select name="club_id">
    <option value="">Select a club...</option>
    <!-- unassigned clubs + clubs in other divisions -->
  </select>
  <button type="submit">Assign</button>
</form>
```

**Move club form (per club row):**
```html
<form method="post" action="/api/admin/move-club" style="display:inline">
  <input type="hidden" name="csrf" value={csrfToken} />
  <input type="hidden" name="club_id" value={club.id} />
  <select name="division_id">
    <!-- all divisions -->
  </select>
  <button type="submit">Move</button>
</form>
```

**Unassign club form:**
```html
<form method="post" action="/api/admin/unassign-club" style="display:inline">
  <input type="hidden" name="csrf" value={csrfToken} />
  <input type="hidden" name="club_id" value={club.id} />
  <button type="submit">Unassign</button>
</form>
```

---

## Tests

### Unit tests at `DivisionAssignments` module interface

| Test | Verifies |
|---|---|
| All pyramid divisions appear, including empty ones | All `pyramid_divisions` rows, all levels 1–10 |
| Assigned clubs render under their current division | Club appears in correct division based on `division_assignments` |
| Friendlies do not appear | No competition record leaks into division list |
| Assigning unassigned club creates row | Insert, audit log written |
| Assigning already-assigned club moves it | Row updated, audit log written, old division no longer shows club |
| Unassign deletes row | Row removed, club appears in unassigned, audit log written |
| Assign/move/unassign clears clubs.competition_code | `clubs.competition_code` is NULL after operation |
| Over-capacity succeeds and returns warning | Division max_size < count; operation succeeds, warning string returned |
| Over-capacity warning included in view model response | Warning propagates to UI |
| Capacity check uses distinct clubs, not rows | Multiple assignments to same club count once |

### Route tests

| Test | Verifies |
|---|---|
| Assign success redirects | 303 with success message |
| Move success redirects | 303 with success message |
| Unassign success redirects | 303 with success message |
| Assign with invalid club returns error | 303 with error message |
| Assign with invalid division returns error | 303 with error message |
| CSRF error rejects | 403 JSON |
| No session rejects | 401 JSON |

### Admin clubs test updates

Existing `adminClubs.test.ts` functions remain unchanged since the club detail/update module is not affected.

---

## Implementation Order

### Phase 1: Schema and backfill

Steps:
1. Add migration `020-division-assignments.sql`
2. Write backfill script
3. Run backfill on local and remote D1
4. Verify data matches current latest-season memberships

### Phase 2: Deep module

Steps:
1. Create `lib/admin/divisionAssignments.ts` with `getDivisionAssignments()`, `assignClubToDivision()`, `moveClubToDivision()`, `unassignClub()`
2. Write unit tests at module interface
3. Verify tests pass

### Phase 3: Replace admin screen read model

Steps:
1. Update `app/admin/publish/page.tsx` to use `getDivisionAssignments()` instead of `getAllCompetitionsWithClubs()`
2. Change page title to "Division Assignments"
3. Add capacity display (X/Y clubs)
4. Verify all divisions appear (levels 1–10)
5. Verify empty divisions appear
6. Verify friendlies gone

### Phase 4: Assignment API routes

Steps:
1. Create `app/api/admin/assign-club/route.ts`
2. Create `app/api/admin/move-club/route.ts`
3. Create `app/api/admin/unassign-club/route.ts`
4. Write route tests

### Phase 5: Assignment UI forms

Steps:
1. Add "Assign club" form per division (select from unassigned + other-division clubs)
2. Add "Move" button per club row with division select
3. Add "Unassign" button per club row
4. Add over-capacity warning display
5. Add success/error message banners for new routes

### Phase 6: Cleanup and deploy

Steps:
1. Run full test suite
2. Run full build
3. Deploy migration to remote D1
4. Run backfill on remote D1
5. Deploy build

---

## Rollback

### Database
- Migration `020-division-assignments.sql` should have a corresponding `.down.sql` that drops the table.
- Old season tables (`pyramid_season_memberships`, `pyramid_season_divisions`) remain populated and intact.

### Code
- The old `getAllCompetitionsWithClubs()` function stays in `lib/admin/clubs.ts` until confidence is gained.
- The publish API routes remain unchanged and backward-compatible.
