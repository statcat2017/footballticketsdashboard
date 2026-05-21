# Non League Matters Feasibility Note

Status: evaluated for GitHub issue #58 on 2026-05-21.

## Current Recommendation

Do not build a dedicated Non League Matters adapter yet.

Use Non League Matters as a manually checked reference source only until reuse permission and venue enrichment are resolved. The current import infrastructure can stage normalized rows with missing venue data, but production `fixtures` still require `venue_id`, and public search/travel behaviour assumes fixtures have venues. Importing NLM rows without a trusted venue path would either block before publish or require schema and product changes outside this research issue.

The next safe step is to pursue permission or partnership, then route any approved NLM import through the generic static HTML table or agent-scrape import pipeline once those adapters are implemented. A source-specific adapter should wait until that pipeline can preserve evidence, honour robots/rate limits, and keep unresolved venue rows in review.

## Source Overview

Non League Matters exposes a static public fixtures page at `https://www.nonleaguematters.co.uk/global/fixtures/`.

The page is a server-rendered "Next 250 Fixtures" table snapshot. In the current sample it covered upcoming fixtures grouped by date, with compact league codes, home teams, away teams, and kickoff times.

Division pages such as `https://www.nonleaguematters.co.uk/divisions/215/` expose richer competition context, current and historic season links, league tables, results, fixtures, and attendance-like numeric cells. They still do not expose venue or postcode fields in the public HTML inspected for this issue.

## What Is Available

- Date group headers rendered as separate fixture tables.
- League/competition code.
- Home team name.
- Away team name.
- Kickoff time.
- Stable-looking division URLs such as `/divisions/215/`.
- Stable-looking season URLs below each division, such as `/divisions/215/16/`.
- Division-level metadata such as official site link, level, promotion target, relegation target, and last-updated text.
- Historic results and fixture rows on division pages, which may help with later reconciliation if reuse is approved.

## What Is Not Available

- Venue / ground name.
- Postcode.
- Team detail pages.
- Fixture source URLs.
- Stable fixture IDs on the global fixtures page.
- Clear public reuse permission for the live fixtures area.
- Machine-readable export/API contract.
- Explicit fixture row provenance beyond page URL, date group, league code, teams, and time.

## Licensing And Robots Considerations

- `robots.txt` currently includes `Crawl-delay: 10` for `User-agent: *`, disallows internal asset/admin paths, then later includes another `User-agent: *` block with `Disallow: /`. Treat this as restrictive/ambiguous rather than permission to crawl.
- The site also explicitly disallows `GPTBot` and `The Knowledge AI`. Even though that does not directly define app ingestion rights, it reinforces that automated reuse should be conservative.
- No explicit licence or fixture data reuse permission was found in the pages inspected.
- Do not run broad crawls, scheduled scraping, or automated production imports without written permission or another approved data-sharing basis.
- If permission is granted, honour crawl delay, cap fetch frequency, record source URLs/evidence, and avoid fetching disallowed paths.

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
- `season_id` from division season URLs.
- attendance/result values from division pages, if those pages are later approved as source material.

## Blockers

- Reuse permission is unresolved.
- Robots policy is ambiguous/restrictive for broad automated collection.
- Venue names and postcodes are absent from the global fixture page and division pages inspected.
- The production `fixtures` table requires `venue_id`, and search/travel code joins fixtures to venues.
- There are no stable fixture IDs, so idempotency would rely on synthetic keys that can collide when dates/times/opponents change.
- Competition codes and club names still need mapping to local pyramid divisions/clubs before publish.

## Venue Enrichment Gap

An importer would still need one of the following:

- a second venue-enrichment source, or
- a schema change that allows fixtures to exist without a venue.

Without one of those, the global fixtures page cannot fully populate the current fixture model.

Do not fabricate venues from home-team names. The safest current approach is to stage fixture rows with `venueRaw`/`venueResolvedId` empty, mark them as unresolved, and require a separate approved venue source or manual admin resolution before publish.

## Follow-Up Schema And Importer Work

- Decide whether published fixtures may have nullable `fixtures.venue_id`; if yes, update search, travel cache, fixture cards, and admin validation to handle missing venues explicitly.
- If published fixtures must keep `venue_id` required, add an import review state that blocks NLM rows until venue resolution succeeds.
- Add a source-specific provenance model for synthetic NLM identity: source URL, page type, date header, league code, home name, away name, kickoff time, division ID, season ID, scrape timestamp, and parser version.
- Add source registry evidence requirements for NLM, with `trust_level = 'untrusted'` until written reuse permission exists.
- Extend validation to flag missing NLM venue data as a blocker, not a warning, unless nullable fixture venues are intentionally supported.
- Implement NLM ingestion, if approved, through the source-agnostic HTML table or agentic structured-row adapters rather than a standalone scraper first.
- Keep club/competition mapping and venue/postcode enrichment as separate steps from fixture row extraction.

## Issue #58 Resolution

Issue #58 is satisfied as a research/documentation outcome. The recommendation is to defer implementation and not build an adapter from this issue.

If the project later proceeds, the safest path is:

1. Confirm written reuse permission or partnership terms.
2. Confirm robots/rate-limit handling for any automated access.
3. Use the generic static HTML table or agent-scrape adapter to create an import batch.
4. Preserve row-level evidence and synthetic source identity.
5. Leave venue unresolved when no trusted venue source exists.
6. Resolve venues from a separate approved source before publish, unless the product explicitly supports venue-less fixtures.

## Evidence

- Global fixtures page: `https://www.nonleaguematters.co.uk/global/fixtures/`
- Example division page: `https://www.nonleaguematters.co.uk/divisions/215/`
- Robots policy is restrictive/ambiguous and includes a broad `Disallow: /` block plus 10-second crawl delay.
- Division pages expose stable-looking IDs and season paths, but no public club pages or venue/postcode fields were found in the public HTML inspected.
- Current import batch rows can store missing `venueRaw`/`venueResolvedId`, but production fixtures require `venue_id` and search/travel code assumes a venue join.
