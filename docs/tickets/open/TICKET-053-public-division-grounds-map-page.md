# TICKET-053: Public Division Grounds Map Page

Status: open
Owner: Frontend / Backend
Priority: medium
Depends on: none

## Purpose

Create a public division detail page at `/divisions/[code]` that shows all clubs in a league and their grounds on a Leaflet map.

## Design

### Route

`/divisions/[code]` e.g. `/divisions/national-league`, `/divisions/premier-league`

The `code` comes from `pyramid_divisions.code`.

### Page layout

```
[Header: Division name, level, club count]
[Map: Full-width Leaflet map with markers for each club's venue]
[Club list: table or cards below the map]
```

### Map features

- One marker per club at its venue coordinates
- Marker popup shows: club name, venue name, postcode
- Clustering at zoom levels where markers overlap (use Leaflet.markercluster)
- Map bounds fit all markers on load
- Colour markers by coordinate precision:
  - `exact` / `postcode` — green
  - `ground_approximate` — amber
  - `unknown` or missing — red
- Click marker → popup with link to club detail (when club pages exist)

### Club list

- Club name
- Venue name
- Postcode
- Coordinate precision badge (same colour logic as map)
- Link placeholder for future club detail pages

### Data fetching

Server-side query joining:

```
pyramid_season_memberships
  -> pyramid_clubs (name)
  -> season_divisions
     -> pyramid_divisions (filter by code)
  -> club_venue_assignments (is_primary=1, effective_to IS NULL)
     -> venues (lat, lng, postcode, name, coordinate_precision)
```

Fallback: if a club has no primary venue, show it in the list with a "Venue unknown" label but no map pin.

### Empty states

- Division not found → 404
- No clubs in division for current season → friendly message
- Clubs exist but no venues with coordinates → show list only, no map

## Work

### Server

1. Create `lib/divisions.ts` with `getDivisionByCode(code)` returning division + clubs + venues
2. Query current season from `fixture_seasons` or `pyramid_seasons`
3. Return 404 if division code not found

### Page

4. Create `app/divisions/[code]/page.tsx` — server component, fetches data, renders map + list
5. Create `app/divisions/[code]/DivisionMap.tsx` — client component, Leaflet map with markers
6. Implement marker clustering
7. Add popup content per marker
8. Add colour coding by coordinate precision

### Tests

9. Test `getDivisionByCode` returns clubs with venue data
10. Test unknown division code throws/404
11. Test division with no club venues renders list-only
