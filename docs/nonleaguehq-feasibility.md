# NonLeagueHQ Feasibility Note

## Source Overview

NonLeagueHQ exposes a WordPress-backed set of public fixture and club pages, including fixture-finder pages, next-fixtures pages, results pages, and club information pages.

The clearest fixture-like endpoints are:

- `/fixture-finder/`
- `/fixture-finder-england-step-5/`
- `/england-next-fixtures-steps-1-to-6/`
- `/next-fixtures-at-a-glance/`

Some "at a glance" views are iframe shells over Google Sheets exports.

## What Is Available

- Competition/division labels.
- Fixture lists grouped by competition or date depending on page type.
- Home and away club names.
- Some club pages with club metadata such as ground name, nickname, colours, manager, and league.
- Stable-looking WordPress slugs for many public pages.
- WordPress REST endpoints and standard site search.

## What Is Not Available

- Clean public fixture IDs for the main fixture pages.
- Complete venue/postcode coverage.
- A consistent machine-readable fixture export on the main site pages.
- Clear explicit reuse permission for fixture data.

## Importable Fields

These fields can be mapped with moderate confidence:

- competition label or league/step grouping.
- home club name.
- away club name.
- fixture date/time where the page provides it.
- club metadata where available on club pages.

Potentially useful but not reliable yet:

- WordPress object IDs behind REST results.
- slug-derived source IDs.
- club ground names from profile pages.

## Missing Pieces

An importer would still need one or more of the following:

- a venue/postcode enrichment source,
- a stable fixture export or API,
- clearer permission to reuse the data,
- normalization for inconsistent page schemas.

## Schema Changes Likely Needed

- Allow fixture imports to exist without a complete venue record.
- Add source provenance fields for slug/sheet-derived rows.
- Keep venue enrichment and fixture ingestion separate.

## Recommendation

Use NonLeagueHQ as a scrapeable reference source, not a production fixture feed, until reuse permission and venue coverage are resolved.

If we proceed, the safest path is:

1. Treat the Google Sheets-backed fixtures as the primary ingest target.
2. Use club pages only for enrichment.
3. Resolve venue/postcode data from a second approved source.

## Evidence

- Public pages include WordPress fixture, result, and club-information routes.
- `robots.txt` is permissive except for `/wp-admin/`.
- Club pages exposed ground names and related metadata, but not full postcode coverage in the pages inspected.
