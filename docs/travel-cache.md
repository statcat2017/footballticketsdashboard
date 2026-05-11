# Travel Cache

Travel estimates are cached by `postcode_district + venue_id` in `travel_cache`.

## Providers

- Driving time: OpenRouteService via `OPENROUTESERVICE_API_KEY`
- Public transport time: TravelTime via `TRAVELTIME_APP_ID` and `TRAVELTIME_API_KEY`

If provider credentials are missing or a provider call fails, search still falls back to straight-line distance and does not fail.

## Search Warm-Up

Successful searches now trigger a best-effort background cache warm-up for the searched postcode district and date window when provider credentials are configured.

That means:

- the first search for a new postcode district may still show distance-only fallback
- the search response is not blocked on live provider calls
- later searches for the same postcode district can reuse the warmed cache rows

## Manual Fill Commands

Local SQLite:

```bash
npm run travel:fill -- "SW6 1HS"
```

Remote D1:

```bash
npm run travel:fill:d1 -- football "SW6 1HS"
```

All known ground districts locally:

```bash
npm run travel:fill:grounds
```

All known ground districts in D1:

```bash
npm run travel:fill:grounds:d1 -- football
```

Optional date window arguments can be passed after the postcode:

```bash
npm run travel:fill -- "SW6 1HS" 2026-05-11 2026-05-21
```

These commands:

- find upcoming venues with no cache row for the supplied postcode district
- request driving and public-transport travel times when credentials are available
- write successful provider results back into `travel_cache`
- skip writes when only distance-only fallback is available

The ground prewarm commands:

- derive unique postcode districts from all known venue postcodes
- fill missing district-to-venue travel rows across the venue set
- complement the on-search warm-up for districts that have not been searched yet

## Notes

- Cached rows can contain one travel mode with the other left `NULL`.
- The `provider` field records which upstream providers succeeded for that row, for example `openrouteservice`, `traveltime`, or `openrouteservice+traveltime`.
- Search still reads from the cache and never blocks on live travel API requests.
