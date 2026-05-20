# 2025-26 Northern Premier League (Premier Division) — Club Grounds Research

**Season used:** 2025–26 (Wikipedia page exists and contains full Stadia and locations table)

**Division:** Step 3 / Level 7 of the English football pyramid (Northern Premier League Premier Division)

**Data sourced:** 2025-05-20

---

## Notes on data quality

- **Coordinates** sourced from Wikipedia (club articles or dedicated ground articles) as first preference. Where Wikipedia had no coordinates, Nominatim (OpenStreetMap) was used as fallback.
- **Postcodes** sourced from [postcodes.io](https://postcodes.io) reverse geocoding, or extracted from Nominatim display_name where postcodes.io returned no result for the raw coordinates.
- **Groundshare** status determined by searching each club's Wikipedia article extract for keywords ("groundshare", "share", "play at", "ground"). No groundshares were detected among these 21 clubs.
- **Cleethorpes Town** — the Wikipedia table lists "Clee Road" as the ground; the club plays at The Linden Club, which is located on Clee Road. These refer to the same venue.
- **Morpeth Town (Craik Park)** — no dedicated Wikipedia ground article with coordinates exists. The coordinate pair used comes from the Morpeth Town A.F.C. Wikipedia page (town-level coords), so they are approximate for the ground itself.
- **Ilkeston Town (New Manor Ground)** — postcodes.io returned no match for the ground coordinates. The postcode shown (DE7 8JF) is taken from the Nominatim display_name for "New Manor Ground, Ilkeston".
- **Warrington Rylands 1906** — the club page coordinates (53.4, -2.576) are rounded to 1 decimal place on Wikipedia, giving lower precision than other entries.

---

## Club grounds table

| # | Club | Ground | Town | Postcode | Latitude | Longitude | Groundshare? | Source |
|---|---|---|---|---|---|---|---|---|
| 1 | Ashton United | Hurst Cross | Ashton-under-Lyne | OL6 8DZ | 53.501389 | -2.079722 | No | Wikipedia (club page) |
| 2 | Bamber Bridge | Irongate | Bamber Bridge | PR5 6UY | 53.727778 | -2.671944 | No | Wikipedia (club page); postcode from Nominatim |
| 3 | Cleethorpes Town | Clee Road (The Linden Club) | Grimsby | DN32 8QL | 53.555379 | -0.055573 | No | Wikipedia (club page); postcode from Nominatim |
| 4 | FC United of Manchester | Broadhurst Park | Manchester (Moston) | M40 0FJ | 53.516700 | -2.180400 | No | Wikipedia (Broadhurst Park page) |
| 5 | Gainsborough Trinity | The Northolme | Gainsborough | DN21 2HZ | 53.403333 | -0.774444 | No | Wikipedia (The Northolme page) |
| 6 | Guiseley | Nethermoor Park | Guiseley | LS20 8BT | 53.877222 | -1.719444 | No | Wikipedia (Nethermoor Park page) |
| 7 | Hebburn Town | The Green Energy Sports Ground | Hebburn | NE31 1ES | 54.968611 | -1.523889 | No | Wikipedia (club page) |
| 8 | Hednesford Town | Keys Park | Hednesford | WS12 2DZ | 52.697600 | -1.988831 | No | Wikipedia (Keys Park page) |
| 9 | Hyde United | Ewen Fields | Hyde | SK14 2SD | 53.450556 | -2.068056 | No | Wikipedia (Ewen Fields page) |
| 10 | Ilkeston Town | New Manor Ground | Ilkeston | DE7 8JF | 52.983889 | -1.300278 | No | Wikipedia (club page); postcode from Nominatim |
| 11 | Lancaster City | The Giant Axe | Lancaster | LA1 5PF | 54.051111 | -2.811111 | No | Wikipedia (club page) |
| 12 | Leek Town | Harrison Park | Leek | ST13 8LF | 53.109722 | -2.039722 | No | Wikipedia (club page) |
| 13 | Morpeth Town | Craik Park | Morpeth | NE61 2YX | 55.156110 | -1.708610 | No | Wikipedia (club page — town-level, approximate) |
| 14 | Prescot Cables | IP Truck Parts Stadium | Prescot | L34 6HH | 53.431944 | -2.804722 | No | Wikipedia (club page) |
| 15 | Rushall Olympic | Dales Lane | Walsall (Rushall) | WS4 1LJ | 52.601092 | -1.952515 | No | Wikipedia (club page); coords/postcode refined via Nominatim |
| 16 | Stocksbridge Park Steels | Bracken Moor | Stocksbridge | S36 2AN | 53.477222 | -1.586944 | No | Wikipedia (club page) |
| 17 | Stockton Town | Bishopton Road West | Stockton-on-Tees | TS19 0QD | 54.570556 | -1.339722 | No | Wikipedia (club page) |
| 18 | Warrington Rylands 1906 | Gorsey Lane | Warrington | WA2 7SQ | 53.400000 | -2.576000 | No | Wikipedia (club page) |
| 19 | Warrington Town | Cantilever Park | Warrington | WA4 2RR | 53.377025 | -2.569928 | No | Wikipedia (club page) |
| 20 | Whitby Town | Turnbull Ground | Whitby | YO21 3HY | 54.490000 | -0.627500 | No | Wikipedia (club page) |
| 21 | Workington | Borough Park | Workington | CA14 2DT | 54.648611 | -3.551111 | No | Wikipedia (Borough Park page) |

---

## Methodology

1. **Club & ground list** — extracted from the "Stadia and locations" table on the [2025–26 Northern Premier League Wikipedia page](https://en.wikipedia.org/wiki/2025%E2%80%9326_Northern_Premier_League). 21 clubs (Widnes resigned before the season and is not listed in the stadia table).

2. **Coordinates** — queried via the Wikipedia API (`action=query&prop=coordinates`). If the club article had coordinates they were used directly. If not, the dedicated ground article was queried (e.g. Broadhurst Park, Keys Park, Ewen Fields). Where neither existed, Nominatim (OpenStreetMap) was used as fallback.

3. **Postcodes** — reverse-geocoded from coordinates using [postcodes.io](https://postcodes.io/postcodes?lon=...&lat=...). Where postcodes.io returned no result, the postcode was extracted from the Nominatim display_name.

4. **Groundshare check** — each club's Wikipedia article extract was searched for "groundshare", "share", "play at", "ground". None of the 21 clubs showed evidence of groundsharing.

5. **Non-league context** — all 21 clubs play at their own named grounds. No temporary or inter-club groundshares (a common practice in lower tiers) were identified for this set of clubs in the 2025-26 season.
