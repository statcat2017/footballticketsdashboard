# Data Sources

This seed covers Premier League clubs only for the 2025-26 demo data.

Club membership and `football_data_team_id` values were checked against the football-data.org Premier League teams endpoint for the 2025 season on 2026-05-10. The endpoint returned 20 clubs. Team IDs were included only where the API response matched the club name confidently.

Ground names and postcodes were checked against official club, stadium, Premier League, or local authority venue pages. Football-data venue fields were not used as the final authority because a few entries are stale for the current demo season, including Everton's move to Hill Dickinson Stadium and Brentford's move from Griffin Park.

Coordinates are decimal latitude/longitude values intended for distance calculations, not legal address validation. They were checked against OpenStreetMap-style venue lookups and Wikidata where a stable stadium item was available. Everton uses the Wikidata Hill Dickinson Stadium item because it provides a direct coordinate source for the new ground.

`price_source_url` currently points to each club's official ticketing page. The CSV does not contain extracted adult admission prices, so these URLs are only seed references for later best-effort price capture. Pricing remains subject to fixture category, membership status, concessions, cup rules, and availability.

Known verification limitations:

- Everton's public sources vary between stadium naming, postal, and dock-address formats. The row uses Hill Dickinson Stadium with the L5 9SR venue address from Everton's premium venue information page and Wikidata coordinates for the stadium item.
- Brentford's football-data venue field still reports Griffin Park, so the row uses Gtech Community Stadium based on Premier League stadium information.
- Brighton, Nottingham Forest, and Tottenham postcodes were corrected from current venue/contact sources rather than football-data address fields.
- No fields were intentionally left blank in this Premier League seed.

## Championship

`data/championship-clubs.csv` covers the 24 EFL Championship clubs for the 2025-26 season. Club membership and `football_data_team_id` values were checked against the football-data.org Championship teams endpoint for the 2025 season on 2026-05-10. The endpoint returned 24 clubs, and every row has a confident football-data team ID match.

Ground names and postcodes prefer current official club or stadium pages over football-data venue fields. This matters because several football-data entries use stale or sponsor-old venue names. Ticket and price source URLs point to official club ticketing pages; the seed does not extract adult admission prices, and pricing remains subject to fixture category, membership, concessions, cup rules, and availability.

Coordinates are decimal latitude/longitude values intended for distance calculations. They were generated from the listed stadium postcodes through postcodes.io postcode centroids. They should not be treated as legal address data or precise turnstile entrances.

Known verification limitations:

- Coventry City's football-data venue field still reports St Andrew's, so the row uses Coventry Building Society Arena with the CV6 6GE postcode from current stadium/club sources.
- Birmingham City uses the current St. Andrew's @ Knighthead Park naming; older sources may still show St Andrew's or St. Andrew's Stadium.
- Hull City, Derby County, Swansea City, and Queens Park Rangers have sponsor or legacy naming differences in common sources. The rows use MKM Stadium, Pride Park Stadium, Swansea.com Stadium, and Loftus Road respectively.
- Queens Park Rangers sources vary between Loftus Road branding and sponsored stadium naming. The row uses the stable ground name and the W12 7PJ venue postcode used for this MVP distance seed.
- No fields were intentionally left blank in this Championship seed.
