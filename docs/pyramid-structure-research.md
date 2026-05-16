# Pyramid Structure Research Log

## Summary

Four subagents researched the full English football pyramid structure (Men's) for the 2025-26 season. All divisions and promotion/relegation edges from Level 1 (Premier League) through Level 10 (Step 6) are now defined in the pyramid model. Level 11+ (Step 7+) is explicitly excluded — see Boundary Decision below.

## Boundary Decision

**Cap the pyramid model at Level 10 (Step 6).** Edges represent **possible or recognised movement paths** between adjacent levels, not guaranteed annual movements. In the National League System (especially Steps 3–6), promotion and relegation are often allocation-dependent and can vary by geography, league balancing, and lateral movement. Reciprocal paths exist where movement is genuinely possible both ways.

Rationale:

- The National League System (FA's own regulatory framework) formally encompasses Steps 1-6 (Levels 5-10).
- Step 7 was formally abolished in 2020-21 and replaced by "NLS Feeder Leagues" (Level 11) organised by county FAs on an ad-hoc basis.
- Below Level 10 there is no standardised promotion/relegation mechanism — promotion is "arranged according to separate agreements with appropriate county feeder leagues."
- Level 11 has ~49 leagues with ~772 clubs, many of which are reserve teams of higher-level clubs.
- For a fixture finder targeting Non-League Day audiences, Level 10 covers the entire formal NLS structure with Wikipedia-structured data, FA Vase eligibility, and clear pyramid paths to the Premier League.
- See Subagent 4 output for full analysis.

## Division Count by Level

| Level | Step | # Divisions | # Clubs (modelled / capacity) |
|-------|------|-------------|-------------------------------|
| 1 | — | 1 | 20 / 20 |
| 2 | — | 1 | 24 / 24 |
| 3 | — | 1 | 24 / 24 |
| 4 | — | 1 | 24 / 24 |
| 5 | 1 | 1 | 24 / 24 |
| 6 | 2 | 2 | 48 / 48 |
| 7 | 3 | 4 | 0 / 88 |
| 8 | 4 | 8 | 0 / 176 |
| 9 | 5 | 16 (1 existing + 15 new) | 24 / ~332 |
| 10 | 6 | 17 (2 existing + 15 new) | 37 / ~346 |
| **Total** | 1-6 | **52 divisions** | **225 clubs / ~1,082 capacity** |

## Sources

### Level 7 (Step 3)
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Northern_Premier_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Isthmian_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Southern_Football_League

### Level 8 (Step 4)
- Same sources as Level 7 (Division One sections)
- https://en.wikipedia.org/wiki/National_League_System

### Levels 9-10 (Steps 5-6)
- https://en.wikipedia.org/wiki/National_League_System
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Combined_Counties_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Eastern_Counties_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Essex_Senior_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Hellenic_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Midland_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Northern_Counties_East_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Northern_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Southern_Counties_East_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Spartan_South_Midlands_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Southern_Combination_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_United_Counties_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Wessex_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_Western_Football_League
- https://en.wikipedia.org/wiki/2025%E2%80%9326_South_West_Peninsula_League

### Level 11+ (Step 7+) Boundary
- https://en.wikipedia.org/wiki/National_League_System
- https://en.wikipedia.org/wiki/English_football_league_system
- https://en.wikipedia.org/wiki/Dorset_Premier_Football_League
- https://en.wikipedia.org/wiki/Cheshire_Association_Football_League

## Key Findings

### Naming
- All Step 3 divisions carry the "Pitching In" sponsorship prefix (not included in our codes).
- "Southern League" is officially "Southern Football League". Division names reflect the official name.

### Edge Model Semantics

Edges in `MEN_PYRAMID_EDGES` represent **recognised possible movement/allocation paths** between adjacent levels, not guaranteed annual movements. Some edges are fixed (EFL Championship ↔ League One). Others, mainly in the National League System, are allocation-dependent and may vary by geography, vacancies, lateral movement, and NLS Committee decisions.

A future migration should classify edges as `fixed` or `allocation_dependent`.

### Cross-League Promotions
Promotion from Step 4 to Step 3 and Step 5 to Step 4 is not strictly 1:1 by league family. The NLS Committee can reallocate based on geography and vacancies. All plausible allocation paths are included in the edge model, with full reciprocity where movement is possible both ways.

### Max Sizes
- Steps 1-4: Uniform 22-24 team divisions
- Steps 5-6: Variable 16-24 team divisions based on geography

### Southern League URL
The Southern League Wikipedia page lives at `Southern_Football_League`, not `Southern_League`.
