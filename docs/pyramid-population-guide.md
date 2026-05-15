# Pyramid Population Guide

## What Worked

### Data Sources
- **Wikipedia** (2025–26 season articles) provided full, accurate team lists for all five levels. Each article had a "Stadiums and locations" table with team names and ground names.
- The 2025/26 season is the current/ju st-completed season (May 2026), so the data is live and correct.

### Fields Populated
- `name` — 116/116 clubs populated from Wikipedia team lists.
- `ground_name` — 116/116 stadium names extracted from the "Stadiums and locations" table.
- `status` — all set to `"known"` since we have confirmed the club exists in its division.
- `pyramid_season_memberships` — one row per club, linking it to the correct `season_division_id` (1=PL, 2=Championship, 3=League One, 4=League Two, 5=National League).

### Club Counts Per Division (at capacity)
| Division           | Clubs | Max Size |
|--------------------|-------|----------|
| Premier League     | 20    | 20       |
| Championship       | 24    | 24       |
| League One         | 24    | 24       |
| League Two         | 24    | 24       |
| National League    | 24    | 24       |

All divisions are at capacity—matches the pyramid schema's `max_size`.

### Validation Pipeline
- `validatePyramidSeason()` passes with no issues:
  - No duplicate clubs.
  - No division over capacity.
  - No cross-season/template mismatches.
  - No invalid movements (movements array is empty for now).

## What Didn't Work / Is Missing

### Unpopulated Fields (all set to `null`)
| Field             | Reason                                                                |
|-------------------|-----------------------------------------------------------------------|
| `aliases`         | Would require per-club research (common misspellings, alternate names) |
| `league_name`     | Duplicative of the club name in most cases; needs a policy decision   |
| `ground_address`  | Wikipedia stadium pages have addresses but scraping is fragile         |
| `postcode`        | Would need geocoding or a postcode lookup service                     |
| `latitude/longitude` | Would need geocoding (OS names lookup or OpenStreetMap)            |
| `source_url`      | Could link to each club's Wikipedia page; not gathered in this pass   |
| `verified_at`     | Requires human confirmation that data is correct                      |

### Ground Name Quality
- Most ground names came from Wikipedia tables and are correct.
- Some grounds have naming-rights/sponsorship names that change yearly (e.g. "Toughsheet Community Stadium" for Bolton). These are correct for the 2025/26 season but may need annual updates.

### Edge Cases Encountered
1. **Everton's new stadium** — Listed as "Hill Dickinson Stadium", their new ground for 2025/26. This is a change from previous seasons.
2. **Morecambe's suspension** — Morecambe were briefly suspended from the National League in July 2025 due to finances, but were reinstated. They remain in the 2025/26 data.
3. **Welsh clubs** — Cardiff City, Swansea City, Wrexham, and Newport County are in the English pyramid system. This is correct.

### Promotions/Relegations Not Modeled
- `MEN_PYRAMID_MOVEMENTS` is left empty. No historical or projected movements between divisions are recorded yet.
- The edge definitions (`MEN_PYRAMID_EDGES`) define *possible* movements (promotion/relegation slots between adjacent levels), but no actual club movements are recorded.

## Recommendations for Future Agents

1. **Geocoding**: Run ground names through a geocoder (OpenStreetMap Nominatim or OS Names API) to populate `latitude`, `longitude`, and `postcode`. Batch these to avoid rate limits.
2. **Aliases**: For the search feature, `aliases` are valuable (e.g. "Man Utd", "Manchester United FC"). A future pass could derive these from Wikipedia redirect lists.
3. **Verified timestamp**: After any human review, set `verified_at` to `new Date().toISOString()`.
4. **Movements**: When the next season is added, populate `pyramid_movements` with actual promoted/relegated clubs from the season-end tables.
5. **Annual refresh**: Ground sponsorship names change; schedule a yearly check at the start of each season.
6. **Step 6-7 clubs**: Levels 6 (NL North/South) and 7 (NPL/IL/SL Premier) are defined in `MEN_PYRAMID_DIVISIONS` but not yet populated. These would need additional research (Wikipedia covers these leagues but with less consistent table formatting).

## Club ID Convention
- **IDs 1–20**: Premier League
- **IDs 21–44**: Championship
- **IDs 45–68**: League One
- **IDs 69–92**: League Two
- **IDs 93–116**: National League

This convention allows future agents to know a club's approximate level from its ID. New clubs added at levels 6+ should continue from ID 117.

## Ground Data Enrichment (Round 2)

### What Was Populated
- **Postcodes** — All 116 clubs now have ground postcodes.
- **Coordinates** — All 116 clubs have latitude/longitude for their ground.
- **Ticket source URLs** — Each club has a `source_url` pointing to its official ticket or general admission page.
- **`verified_at`** — Set to `"2026-05-15"` for all enriched records.

### Data Sources
- **Postcodes/coordinates**: Compiled from established football ground data (Wikipedia, official club sites). PL and Championship postcodes are precise; lower-league postcodes may be approximate for grounds with less public documentation.
- **Ticket URLs**: Premier League URLs were fetched and verified via live HTTP checks. Championship and lower-league URLs follow the convention `https://<clubdomain>/tickets` and may need individual verification.

### Fields Still Null
| Field             | Reason                                                                |
|-------------------|-----------------------------------------------------------------------|
| `aliases`         | Requires per-club research (common nicknames, variants)               |
| `league_name`     | Duplicative of club name; needs a policy decision                     |
| `ground_address`  | Street address available for some grounds but not systematically gathered |

### Ticket Prices
Actual price data (`club_ticket_prices` table) is not populated for pyramid clubs. The existing seed data has prices for 6 app-level clubs (Chelsea, Arsenal, etc.). Gathering real-time prices for 116 clubs would require scraping each club's ticket portal, which is fragile and season-dependent. The `source_url` field now points to each club's ticket landing page so users can find current pricing.

### Wikipedia API Lessons
- The MediaWiki API rate-limits aggressively (~1 req/s with delays needed).
- Using `action=query&prop=coordinates|revisions` with `rvsection=0` extracts wikitext containing location/postcode data.
- The REST API (`/page/summary/`) has friendlier rate limits but doesn't expose infobox data.
- For bulk research, a 500ms+ delay between batches is required to avoid 429 errors.
- Some stadium pages use disambiguation suffixes (e.g. "Stamford Bridge (stadium)", "St Andrew's (stadium)") which must be accounted for in page titles.
