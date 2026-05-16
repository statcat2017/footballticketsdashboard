# TICKET-032: Google Maps Venue Coordinate Picker

Status: done
Owner: Frontend
Priority: medium
Depends on:

## Purpose

Venues with `is_approximate = 1` have only approximate coordinates. Manually editing raw lat/lng number fields is tedious and error-prone. A Google Maps picker on the venue detail page lets admins visually search for the precise ground location, place a pin, and save accurate coordinates — clearing the approximate flag in the process.

## Work

### New files

- `app/components/VenueMapPicker.tsx` — Client component:
  - Embedded Google Map centred on current approximate location
  - Google Places Autocomplete search box ("Search for venue or place…")
  - Draggable marker for manual pin placement
  - "Use this location" button that populates lat/lng fields and unchecks `is_approximate`
  - Map re-centres when a place is selected or the marker is dragged
- `.dev.vars` — Add `GOOGLE_MAPS_API_KEY=<key>`
- `cloudflare-env.d.ts` — Add `GOOGLE_MAPS_API_KEY` binding type (if not already present via `getCloudflareEnv`)

### Modified files

- `app/admin/venues/[id]/page.tsx` — When `data.venue.is_approximate === 1`, render `VenueMapPicker` above (or replacing) the manual lat/lng inputs. Keep manual inputs as fallback for non-approximate venues and as an override for power users.
- `lib/runtime-env.ts` — Add `getGoogleMapsApiKey()` accessor if needed (pattern follows existing env accessors).

### No changes needed to

- `lib/admin/venues.ts` — `updateAdminVenue` already accepts `latitude`, `longitude`, and `is_approximate` fields. The form submission path is unchanged.

### UX flow

1. Admin navigates to a venue with `is_approximate = 1` (e.g. a Step 6 ground).
2. A Google Map is displayed showing the approximate location with a marker.
3. The search box says "Search for venue or place…".
4. Admin types "Moss Lane, Altrincham" and selects a suggestion.
5. Map centres on the result, pin drops at precise coordinates.
6. The lat/lng inputs populate and the "Coordinates are approximate" checkbox unchecks.
7. Admin reviews and clicks "Save Changes".
8. On success, the venue now has precise coordinates and `is_approximate = 0`.

### Security

- Google Maps API key stored in `.dev.vars` (local) and Cloudflare Secrets (production).
- Never commit the key to `wrangler.jsonc` or any source file.
- Restrict the API key in Google Cloud Console to the app's domain(s) and Maps JavaScript API + Places API.

## Acceptance Criteria

- A venue with `is_approximate = 1` shows an interactive map on its detail page.
- Admin can search for a place via Google Places Autocomplete.
- Admin can drag the pin to fine-tune.
- Selecting a location or dragging updates the lat/lng form fields and unchecks `is_approximate`.
- Saving the form persists the precise coordinates to the `venues` table.
- Non-approximate venues still show the existing manual lat/lng inputs (no map).
- The map picker degrades gracefully if the Google Maps API key is missing (show a warning + the manual inputs).

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual: visit `/admin/venues/{id}` for an approximate venue → verify map loads → search for a place → verify pin placement → save → reload and verify `is_approximate = 0` and precise coordinates.
