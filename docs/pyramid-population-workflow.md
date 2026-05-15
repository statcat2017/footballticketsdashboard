# Pyramid Population Workflow

A repeatable process for populating any division in the men's English pyramid.

## Input

Accept either:

- **Step number**: `2`, `3`, `4`, `6`, `7`
- **Step range**: `"1-5"`, `"6-7"`
- **League name or code**: `"Isthmian League"`, `"Northern Premier League"`, `"National League North"`, `"premier-league"`

## Step 1 — Resolve the target division(s)

Use the `MEN_PYRAMID_DIVISIONS` table in `lib/db/pyramid.ts` to look up the matching `division_id`, `level`, `max_size`, and `season_division_id`.

| Level | `division_id` | Code | Name | Max size |
|-------|-------------|------|------|----------|
| 1 | 1 | `premier-league` | Premier League | 20 |
| 2 | 2 | `championship` | Championship | 24 |
| 3 | 3 | `league-one` | League One | 24 |
| 4 | 4 | `league-two` | League Two | 24 |
| 5 | 5 | `national-league` | National League | 24 |
| 6 | 6 | `national-league-north` | National League North | 24 |
| 6 | 7 | `national-league-south` | National League South | 24 |
| 7 | 8 | `northern-premier-league-premier` | Northern Premier League Premier Division | 22 |
| 7 | 9 | `isthmian-league-premier` | Isthmian League Premier Division | 22 |
| 7 | 10 | `southern-league-premier-central` | Southern League Premier Central | 22 |
| 7 | 11 | `southern-league-premier-south` | Southern League Premier South | 22 |

The `season_division_id` for a division is the same as its `division_id` (currently one season only, `season_id = 1`).

**Name matching rules:**
- `"National League"` → division_id 5 (the single league). `"National League North"` → 6, `"National League South"` → 7
- `"Northern Premier League"` → division_id 8. `"Isthmian League"` → 9. `"Southern League"` → ambiguous — ask which: Central or South
- `"Step 6"` → divisions 6 and 7. `"Step 7"` → divisions 8, 9, 10, 11

## Step 2 — Determine the club ID starting point

New clubs must not overlap existing IDs. Use the next available ID:

```typescript
const nextClubId = Math.max(...MEN_PYRAMID_CLUBS.map(c => c.id)) + 1;
```

Current ranges (as of initial population):
| Range | Division |
|-------|----------|
| 1–20 | Premier League |
| 21–44 | Championship |
| 45–68 | League One |
| 69–92 | League Two |
| 93–116 | National League |
| 117–140 | National League North |
| 141–164 | National League South |
| 165–188 | NWCFL Premier Division |
| 189–206 | NWCFL Division One North |
| 207–225 | NWCFL Division One South |
| 226+ | Available for Step 3 (NPL Premier, IL Premier, SL Premier Central/South) |

The same `nextClubId` applies to assignment IDs and venue IDs (one venue per club for new clubs).

## Step 3 — Research the division's teams

### Source
Use Wikipedia for the current season. The English football pyramid articles follow a consistent naming pattern:

```
https://en.wikipedia.org/wiki/2025%E2%80%9326_National_League
https://en.wikipedia.org/wiki/2025%E2%80%9326_National_League_North
https://en.wikipedia.org/wiki/2025%E2%80%9326_Northern_Premier_League
https://en.wikipedia.org/wiki/2025%E2%80%9326_Isthmian_League
https://en.wikipedia.org/wiki/2025%E2%80%9326_Southern_League
```

### What to extract from each page
1. The "Stadiums and locations" table — gives club names and ground names
2. The league table — confirms which clubs are actually in the division that season
3. Ground postcodes/coordinates — from the stadium's own Wikipedia page (see Step 4)

### Known quirks by division
| Division | Quirk |
|----------|-------|
| National League levels | Wikipedia covers NL, NLN, NLS on a single page with separate sections. The `2025–26_National_League` page has three sections: "National League", "National League North", "National League South". Each has its own "Stadiums and locations" table. Use `action=parse&prop=sections` to find the correct section index, then fetch section-specific wikitext or HTML tables. |
| Step 2 grounds | Many NL North/South grounds lack dedicated Wikipedia pages. Use the club's Wikipedia page (`prop=revisions&rvsection=0`) to extract the `ground` field from the infobox, then search separately for ground coordinates/postcodes. |
| Data editing caution | When inserting new array elements into `pyramid.ts`, the `];` pattern appears multiple times (array close, ternary defaults, etc). Always anchor edits to the surrounding `export const` line to avoid inserting into the wrong scope. |
| Step 7 leagues | Wikipedia covers NPL, IL, SL in separate articles. Each has a single "Stadiums and locations" table. |
| Ground names | Some grounds have naming-rights sponsor names that change yearly. Always use the current-season name from the Wikipedia infobox. |
| Welsh clubs | Cardiff, Swansea, Wrexham, Newport play in the English pyramid. Include them. |
| Ground shares | Some non-league clubs groundshare (e.g., two clubs at the same stadium). This is rare at steps 1–5 but common at steps 6–7. When it happens, create one venue row but two `club_venue_assignments`. |

### Rate limits
Wikipedia's API rate-limits at roughly 1 request per second for batch queries. Use `action=query&prop=coordinates|revisions&titles=` with pipe-separated titles (up to 50 per batch) and a 500ms+ delay between batches. For just the club list, use `webfetch` on the league page HTML instead.

## Step 4 — Create the data

You will modify `lib/db/pyramid.ts` and `lib/db/d1.ts`.

### 4a — Add clubs to `MEN_PYRAMID_CLUBS`

Add entries for each club. Use this format:

```typescript
{ id: <nextClubId>, name: "<Club Name>", aliases: null, league_name: null, source_url: "<ticket-url>", verified_at: "<today>", status: "known" },
```

- `source_url`: the club's official ticket page if known, else `null`
- `status`: `"known"` if the club name is verified in the league table, `"partial"` if only a stub

### 4b — Add memberships to `MEN_PYRAMID_MEMBERSHIPS`

One per club:

```typescript
{ id: <nextMembershipId>, season_id: 1, template_id: 1, season_division_id: <divisionId>, club_id: <clubId> },
```

### 4c — Add venues to `SEED_DATA.venues` in `d1.ts`

One per unique ground:

```typescript
{ id: <nextVenueId>, name: "<Ground Name>", postcode: "<PC>", latitude: <lat>, longitude: <lng> },
```

- If two clubs share a ground, reuse the same `venue_id` for both assignments.
- If two different grounds have the same name (e.g., "St. James Park" in Exeter and Brackley), disambiguate: `"St. James Park (Exeter)"`, `"St. James Park (Brackley)"`.
- If a new club uses an already-existing venue (e.g., a London club playing at a venue already in the table), reuse the existing `venue_id`.

### 4d — Add assignments to `CLUB_VENUE_ASSIGNMENTS` in `pyramid.ts`

One per club:

```typescript
{ id: <nextAssignmentId>, club_id: <clubId>, venue_id: <venueId>, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
```

### 4e — Add ticket prices (if possible)

If the club has publicly listed general admission prices, add a row to `SEED_DATA.club_ticket_prices` in `d1.ts`:

```typescript
{ club_id: <clubId>, sale_mode: "all_ticket", adult_price_pence: <pence>, concession_price_pence: <pence>, source_url: "<url>", verified_at: "<today>", confidence: "unknown" },
```

Confidence levels: `"verified"` (confirmed by the agent), `"seed"` (from initial data), `"unknown"` (estimated/scraped).

If prices are not publicly available, leave `source_url` pointing to the ticket landing page and skip the `club_ticket_prices` row.

## Step 5 — Validate

### Run the existing test suite

```bash
npm run lint
npm run test
npm run build
```

### Key validation rules enforced by `validatePyramidSeason()`:

- No club appears in more than one membership per season
- No division exceeds its `max_size`
- Movement references stay within one season/template
- All `club_venue_assignments` reference existing clubs and venues (enforced by FK in local test runs)
- All memberships reference existing season divisions

### Manual checks

- `grep` for duplicate club names in your additions
- `grep` for duplicate ground names (check with `sort | uniq -c | sort -rn`)
- Verify that new venue IDs do not collide with existing ones

## Step 6 — Update this guide

If you encountered anything unexpected, add a note to the "Known quirks" table. If a league had unusual Wikipedia formatting, record the exact article title and structure so the next agent benefits.

## Reference files to modify

| File | What to add |
|------|-------------|
| `lib/db/pyramid.ts` | `MEN_PYRAMID_CLUBS` entries, `MEN_PYRAMID_MEMBERSHIPS` entries, `CLUB_VENUE_ASSIGNMENTS` entries |
| `lib/db/d1.ts` | `SEED_DATA.venues` entries, optionally `SEED_DATA.club_ticket_prices` entries |
| `lib/db/seed.ts` | Usually automatic — feeds from the above |
| `lib/db/schema.ts`, `lib/db/migrations/001-initial.sql`, `lib/db/migrations/002-pyramid-structure.sql` | Only if adding new pyramid divisions (rare) |

## Environment

- Branch from `main` as `feat/pyramid-populate-<division-code>`
- Never commit API keys
- Run `git config user.name "statcat2017-bots"` and `git config user.email "statcat2017-bots@users.noreply.github.com"` before committing
- Push and open a PR with `--reviewer statcat2017`
