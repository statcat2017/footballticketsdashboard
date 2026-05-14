# Non League Matters Feasibility Note

## Source Overview

Non League Matters exposes a static public fixtures page at `https://www.nonleaguematters.co.uk/global/fixtures/`.

The page is a server-rendered "Next 250 Fixtures" table snapshot. In the current sample it covered 250 fixtures across 9 date groups and 59 visible league codes.

## What Is Available

- Date group headers rendered as separate fixture tables.
- League/competition code.
- Home team name.
- Away team name.
- Kickoff time.
- Stable-looking division URLs such as `/divisions/215/`.
- Real numeric `data-team-id` values on some division pages.

## What Is Not Available

- Venue / ground name.
- Postcode.
- Team detail pages.
- Fixture source URLs.
- Stable fixture IDs on the global fixtures page.
- Clear public reuse permission for the live fixtures area.

## Importable Fields

These fields can be mapped directly from the global fixtures page:

- `competition_code` from the league code cell.
- `home_club_name` from the home team cell.
- `away_club_name` from the away team cell.
- `kickoff_at` from the date header plus time cell.
- `source` as `nonleaguematters`.

Potentially useful but not reliable yet:

- `division_id` from linked division pages.
- `source_id` derived from a synthetic hash of date, league code, home team, away team, and kickoff time.

## Missing Pieces

An importer would still need one of the following:

- a second venue-enrichment source, or
- a schema change that allows fixtures to exist without a venue.

Without one of those, the global fixtures page cannot fully populate the current fixture model.

## Schema Changes Likely Needed

- Allow `fixtures.venue_id` to be nullable for non-league imports.
- Add import provenance fields if we want to track synthetic row identity.
- Keep venue/postcode enrichment separate from fixture import.

## Recommendation

Use Non League Matters as a fixture reference source, not a full database source, until venue enrichment and reuse permission are resolved.

If we proceed, the safest path is:

1. Import fixture rows only.
2. Leave venue unset when no trusted venue source exists.
3. Enrich venues from a separate approved source later.

## Evidence

- Global fixtures page: `https://www.nonleaguematters.co.uk/global/fixtures/`
- Robots policy is restrictive and blocks broad crawling.
- Division pages expose stable-looking IDs, but no public club pages or venue/postcode fields were found in the public HTML inspected.
