# TICKET-034: Agentic Full-Pyramid Structure Mapping

Status: open
Owner: Data
Priority: high
Depends on: TICKET-033

## Purpose

The pyramid model currently has 14 divisions across levels 1–10, but only levels 1–6 and 9–10 are fully defined with clubs and venues. Levels 7–8 are incomplete (Step 3 divisions exist but have no clubs, and Step 4 is entirely missing). Step 5 and Step 6 (levels 9–10) only have NWCFL divisions — all other regional feeder leagues at those levels are absent. Promotion/relegation edges stop at Level 7 with no connections to the NWCFL levels below.

This ticket uses **subagents** to research the full men's English football pyramid structure — all divisions, their level/step assignments, and the promotion/relegation paths between them — and populate the `pyramid_divisions` and `pyramid_edges` tables with the complete skeleton. No clubs or teams are added in this phase (that is TICKET-035).

## Scope

**In scope:**
- Add all missing `MEN_PYRAMID_DIVISIONS` entries to `lib/db/pyramid.ts`
- Add all missing `MEN_PYRAMID_EDGES` entries (promotion + relegation) between every adjacent pair of divisions
- Update `MEN_PYRAMID_SEASON_DIVISIONS` to include the new divisions
- Ensure `validatePyramidSeason()` passes with the new structure (no clubs yet, so no capacity or duplicate-club violations)

**Out of scope:**
- Adding clubs/teams to any division (separate ticket, working top-down)
- Adding venues or venue assignments
- Adding ticket prices or source URLs
- Modifying the database schema

## Current state

| Level | Step | Divisions | Status |
|-------|------|-----------|--------|
| 1 | — | Premier League (1 div, 20 clubs) | Complete |
| 2 | — | Championship (1 div, 24 clubs) | Complete |
| 3 | — | League One (1 div, 24 clubs) | Complete |
| 4 | — | League Two (1 div, 24 clubs) | Complete |
| 5 | 1 | National League (1 div, 24 clubs) | Complete |
| 6 | 2 | National League North, National League South (2 divs, 24 each) | Complete |
| 7 | 3 | NPL Premier, Isthmian Premier, SL Premier Central, SL Premier South (4 divs) | **Defined but empty** |
| 8 | 4 | _(none defined)_ | **Missing entirely** |
| 9 | 5 | NWCFL Premier (1 div, 24 clubs) | **Partial — other Step 5 leagues missing** |
| 10 | 6 | NWCFL Div 1 North, NWCFL Div 1 South (2 divs, 18 + 19 clubs) | **Partial — other Step 6 leagues missing** |
| 11+ | 7+ | _(none defined)_ | **Missing entirely** |

## Subagents

### Subagent 1: Level 7 (Step 3) verification

**Goal:** Confirm the 4 existing Step 3 divisions are correct for the 2025–26 season, and determine their max sizes and any division-level details.

**Input:** Current `MEN_PYRAMID_DIVISIONS` entries for IDs 8–11.

**Research:** Fetch Wikipedia articles for the 2025–26 NPL, Isthmian League, and Southern League. Verify division names match live league names. Confirm `max_size` of 22 per division.

**Output:** Verified (or corrected) `MEN_PYRAMID_DIVISIONS` entries for IDs 8–11 + list of which Step 4 divisions promote into each.

### Subagent 2: Level 8 (Step 4) — the missing level

**Goal:** Research and define all Step 4 divisions of the National League System.

**Research targets:** Wikipedia articles for NPL, Southern League, Isthmian League — their Division One sections.

**What to extract:** Division names, max sizes, promotion destinations (which Step 3 division), relegation destinations (which Step 5 division).

**Output:** Complete `MEN_PYRAMID_DIVISIONS` entries + all edges to Level 7 and Level 9.

### Subagent 3: Levels 9–10 (Steps 5–6) — feeder league expansion

**Goal:** Research all Step 5 and Step 6 leagues beyond the existing NWCFL divisions, and map their promotion/relegation paths.

**Research targets:** Wikipedia NLS page "Feeder leagues" section, individual league pages for 2025–26.

**Output:** New `MEN_PYRAMID_DIVISIONS` entries for all Step 5+6 divisions + edges to Level 8 and between Level 9↔10.

### Subagent 4: Level 11+ (Steps 7+) boundary survey

**Goal:** Determine where the pyramid model should stop for this phase. Survey what exists below Step 6.

**Output:** Recommendation: cap at Level 10 (Step 6) or define Level 11 divisions. Clear rationale.

## Compilation

Merge all four subagent outputs into:
- `lib/db/pyramid.ts` — `MEN_PYRAMID_DIVISIONS`, `MEN_PYRAMID_EDGES`, `MEN_PYRAMID_SEASON_DIVISIONS`
- `docs/pyramid-structure-research.md` — research log

Validate with `validatePyramidSeason()`.

## Acceptance Criteria

- All Step 1–6 (Levels 1–10) divisions are defined, or a clear boundary decision is documented for Step 7+.
- Every division has a `level`, `max_size`, `code`, and `name`.
- `MEN_PYRAMID_EDGES` connects every adjacent level pair with promotion and relegation edges.
- `validatePyramidSeason()` passes with zero issues.
- Subagent outputs are documented in a research log.

## Verification

- `npm run lint`
- `npm run test` (pyramid validation tests must pass)
- `npm run build`
