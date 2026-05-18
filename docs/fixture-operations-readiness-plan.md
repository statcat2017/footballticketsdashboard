# Fixture Operations Readiness Plan

## Goal

Make the site operationally ready for real fixture data before fixtures are released.

The system should answer these questions reliably:

- Is this fixture real?
- Is this venue usable for postcode search?
- Is this kickoff time confirmed or assumed?
- Is this ticket information current enough to show?
- Where did the data come from?
- Can an admin fix bad data without editing seed files or spreadsheets?

The priority is data reliability and ingestion. Public polish should support trust and clarity, not expand product scope beyond fixture discovery.

## Core Direction

Fixture ingestion should be source-agnostic.

API feeds and agentic web scrapes are expected to be the most common import paths. CSV paste and upload remain useful fallback and repair tools, but they should not define the architecture.

All source types should flow through the same pipeline:

```text
API feed / agentic scrape / URL table scrape / CSV upload / CSV paste
↓
source adapter
↓
import batch
↓
normalized fixture rows
↓
validation, matching, warnings, and evidence capture
↓
auto-approval for trusted structurally safe rows
↓
manual preview or import review for exceptions
↓
fixture insert/update
↓
public search display with clear caveats
```

## Resolved Decisions

### Data Model

- Add an explicit mapping layer from `pyramid_clubs` to public-search `clubs`.
- Add an explicit mapping layer from `pyramid_divisions` to public-search `competitions`.
- Public fixture import targets `clubs`, not `pyramid_clubs` directly.
- Admin data remains the operational source for pyramid clubs, venues, divisions, and memberships.
- Public clubs and competitions are created or linked through an explicit bulk publish/mapping flow, not implicitly during fixture import.
- Fixture import covers all populated pyramid divisions once their clubs and divisions are mapped.
- Add a lightweight `fixture_seasons` table and store fixture season identity on imported fixtures.
- Use additive schema changes where possible. Fixture participant support may require a targeted fixture schema migration because the current `fixtures` table requires public `clubs` rows for both teams.

### Fixture Identity And Updates

- A fixture is uniquely identified by home participant, away participant, competition, and season.
- Participants are normally mapped public clubs, but a participant can be explicitly marked as a one-off team for invitational, representative, academy, charity, or exhibition fixtures.
- One-off teams must not require public club creation and must not be added to the club mapping layer.
- One-off teams must be explicitly marked by an import source, agent output, or admin action. Unknown team names must not silently become one-off teams.
- One-off participants need a display name, source/evidence, and side (`home` or `away`). They should be excluded from club pages, club aliases, division membership counts, and club default ticket data.
- Kickoff date and time are attributes that can change.
- Latest trusted import wins for explicitly supplied fields.
- Blank import fields must not erase existing admin or fixture data.
- Fixture moves should update the existing fixture rather than creating duplicates.
- Update operations must be audited and linked back to import batch/source metadata.

### Dates, Times, And Statuses

- Store fixture date and kickoff time separately.
- Store or derive `kickoff_at` when date and time are available.
- Treat imported fixture times as UK local time unless a source explicitly says otherwise.
- If no kickoff time is supplied, assume weekend matches are 15:00 and midweek matches are 19:45.
- Assumed times must be stored with a status such as `assumed`, not treated as confirmed.
- Public cards must label assumed times clearly.
- Keep fixture statuses: `scheduled`, `postponed`, `cancelled`, `finished`, and `unknown`.
- Public search should show postponed and cancelled fixtures when they match the date range, clearly labelled and without a ticket CTA.

### Source Trust And Auto-Approval

- Add a `fixture_sources` registry for API feeds, agent scrapes, table scrapes, and manual imports.
- Source trust is assigned by admins per source; it is not inferred from a single successful run.
- Trusted API and trusted agentic scrape sources can auto-approve structurally safe rows.
- Agentic scrape rows must include evidence and confidence metadata before they can be auto-approved.
- Auto-approval must be blocked by:
  - unknown or unmapped clubs unless the participant is explicitly marked as a one-off team with sufficient source evidence
  - unmatched explicit venues
  - missing or invalid venue coordinates
  - ambiguous aliases
  - fixture identity conflicts
  - destructive blank overwrites
  - impossible dates
  - weak or missing agent evidence below the source threshold
- Auto-approval may proceed with warnings for:
  - assumed kickoff times
  - missing ticket information
  - approximate venue coordinates
  - missing or stale travel cache rows

### Ingestion Adapters

- API imports are first-class source adapters.
- Agentic web scrape imports are first-class source adapters.
- URL table scrape is a lightweight adapter for static HTML tables.
- CSV upload and paste are manual fallback adapters.
- Every adapter must produce the same normalized import batch and row structure.
- URL scrape must use strict static fetch rules:
  - allow only `http://` and `https://`
  - reject localhost and private-network targets
  - cap response size and timeout
  - do not execute JavaScript
  - parse static HTML only
  - record failures in the import review queue
- If table scrape fails, admins can still paste/upload data manually and keep the URL as source provenance.

### Import Batches

- Store import batches and row-level outcomes.
- Retain raw import payloads indefinitely for now, with size caps.
- Store source URL, source type, adapter type, season, actor, parse status, approval state, row counts, and raw input reference.
- Store normalized row data, match outcomes, warnings, evidence, and final insert/update/skip result.
- This batch history is required for audit, replay, debugging, and explaining fixture changes.

### Club Matching And Aliases

- Add a structured alias table instead of relying on free-text aliases.
- Support scoped aliases by division or competition.
- Unscoped aliases should be globally unique.
- Scoped duplicate aliases are allowed only when the import context can restrict matching to the relevant division or competition.
- Import matching should use:
  - normalized canonical club names
  - scoped and unscoped aliases
  - source-specific IDs where available
  - suggest-only fuzzy candidates
- Fuzzy matches must not auto-approve in v1. Admins may confirm and optionally save a new alias.

### Venue Matching And Coordinates

- Blank venue in an import row defaults to the mapped home club's current primary venue.
- If the home participant is a one-off team, there is no club primary venue fallback; the row must provide a matched explicit venue.
- Explicit venue text that cannot be matched blocks that row.
- If the home club has no primary venue, the row blocks until the venue is resolved.
- Blank venue postcode is always a warning, not an import blocker.
- Missing or invalid venue coordinates hide affected fixtures from public search until fixed because location search cannot work.
- Add `coordinate_precision` with values such as `exact`, `postcode`, `ground_approximate`, and `unknown`.
- Retain `is_approximate` during transition for compatibility.
- Keep Leaflet and postcodes.io for admin geocoding in this phase.
- Invalidate travel cache for a venue only when coordinates move more than one mile.

### Ticket And Price Data

- Fixture-specific ticket overrides take precedence over home-club defaults.
- Home-club defaults take precedence over `TBC`.
- Missing ticket URL or price does not block import or publication.
- Missing ticket data should appear as a warning in admin and as cautious public copy.
- Public CTA should say `Check club tickets` rather than `Get tickets`.
- Suppress ticket CTAs for postponed and cancelled fixtures.

### Public Display

- Disable demo/historical fixture fallback by default once real imports exist.
- Keep demo fallback behind an explicit `ENABLE_DEMO_FIXTURES` flag, default off in production.
- Default public search should use the next 14 days.
- Add a simple public radius selector, for example `25`, `50`, `100`, and `all` miles.
- Show one global best-effort disclaimer near results.
- Use compact per-card badges for specific caveats:
  - assumed kickoff time
  - approximate venue coordinates
  - missing price
  - distance-only or missing travel
  - postponed or cancelled status
- Do not imply live inventory, guaranteed availability, guaranteed pricing, or exact travel times.

### Queues And Dashboards

- Keep three separate operational surfaces:
  - public corrections queue
  - import review queue
  - live data-quality dashboard
- The data-quality dashboard computes checks live on page load in v1.
- Use severities `error`, `warning`, and `info`.
- `error` means structurally broken or impossible to display safely.
- `warning` means publishable but caveated.
- `info` means cleanup or operational context.
- Division over max size is a warning.
- Blank venue postcode is a warning.
- Missing/invalid coordinates are an error for public search visibility.
- Import review statuses are `open`, `in_review`, `resolved`, and `ignored`.
- Ignored import review items require notes.

### Corrections

- Generalize public corrections beyond pricing.
- Supported issue types should include:
  - `kickoff`
  - `venue`
  - `ticket_price`
  - `ticket_link`
  - `travel`
  - `club_details`
  - `other`
- Fixture cards should include a `Spotted an error?` correction link or form.
- Public corrections remain pending until reviewed.
- Corrections do not auto-apply to live data in this sprint.

### Travel Cache

- Add read-only admin visibility for travel cache.
- Show origin district, venue, distance, drive time, public transport time, provider, and updated date.
- Add filters for missing, distance-only, stale, and failed lookup states where data exists.
- Treat travel cache rows older than 90 days as stale.
- Do not add full travel cache mutation UI in v1.

### Pyramid Explorer

- Public-only pyramid polish is in scope.
- Admin edge editing can wait unless it blocks division mappings or fixture import.
- Public polish should explain populated divisions, approximate venue data, and fixed versus allocation-dependent paths.

### Verification

Every milestone should pass:

```bash
npm run lint
npm run test
npm run build
```

Data/model milestones need service and migration-adjacent tests.

Import milestones need parser, adapter, matching, duplicate/update, and auto-approval tests.

Public UI milestones need component or Playwright coverage where practical.

## Remaining Dependencies

The following dependencies must be implemented before the site can operate real fixture imports safely.

| Dependency | Why It Is Needed | Ticket |
| --- | --- | --- |
| Fixture source registry (schema) | Required for trusted API and agent auto-approval rules | TICKET-036 (schema done) |
| Import batch storage (schema) | Required for audit, replay, preview, scrape failures, and row outcomes | TICKET-036 (schema done) |
| Public mapping layer | Existing fixtures reference `clubs`, while admin data uses `pyramid_clubs` | TICKET-037 (done) |
| Bulk publish/link flow | All populated divisions need public `clubs` and `competitions` before imports can resolve | TICKET-037 (done) |
| Fixture seasons | Duplicate/update identity depends on season | TICKET-038 (schema done) |
| Fixture participant model | One-off fixture teams need displayable participants without creating permanent clubs | TICKET-038 (schema done) |
| Fixture date/time provenance | Assumed kickoff times must be stored and displayed honestly | TICKET-038 (schema done) |
| Broader confidence model | Fixtures, prices, venues, and import rows need shared provenance language | TICKET-038 (schema done) |
| Structured scoped aliases | API/scrape names need deterministic matching without global nickname collisions | TICKET-039 (done) |
| Venue precision and geocoding completion | Public search needs usable coordinates and admin cleanup tools | TICKET-040 (done) |
| Live data-quality dashboard | Admins need a daily view of broken or caveated data | TICKET-041 (done) |
| Import foundation service | Typed helpers for sources, batches, batch rows | TICKET-059 |
| CSV paste adapter | CSV text → normalized import batch | TICKET-060 |
| HTML URL adapter (multi-table) | Static HTML table → normalized import batch | TICKET-061 |
| Validation, matching & manual apply | Row-level validation, club/venue/competition resolution, assumed-time logic | TICKET-062 |
| Import admin UI | New-import page (paste CSV or URL), batch preview, apply action | TICKET-063 |
| Public display updates | Users need warnings, radius filtering, status labels, and no demo fallback | TICKET-046 (deferred) |
| General corrections flow | Users need to report more than price issues | TICKET-047 (deferred) |
| Travel cache visibility | Admins need to see where travel value is missing or stale | TICKET-048 (deferred) |

## Milestones

### Milestone 1: Data Model And Admin Foundations (Complete)

Purpose: make the database and admin model capable of safe imports across all populated divisions.

Tickets:

- TICKET-036: Fixture Source Registry And Import Batch Model — schema complete (migration 012)
- TICKET-037: Public Club And Competition Mapping Publish Layer — done
- TICKET-038: Fixture Season, Time, Provenance, And Confidence Schema — schema complete (migrations 009, 010)
- TICKET-039: Structured Scoped Club Alias Management — done
- TICKET-040: Venue Geocoding, Coordinate Precision, And Travel Invalidation — done
- TICKET-041: Admin Data Quality Dashboard V1 — done and enhanced at Sprint 1 close-out

Exit criteria — all met:

- All populated divisions can be mapped or clearly identified as unmapped.
- Public clubs and competitions can be created or linked without fixture import side effects.
- Admins can fix venue coordinates and see coordinate precision.
- Data-quality checks expose blockers and warnings before real imports run.

### Milestone 2: Fixture Ingestion Pipeline (Sprint 2)

Purpose: implement CSV paste and static HTML table URL import so admins can preview, validate, and manually apply fixtures.

Tickets:

- TICKET-059: Fixture Import Foundation Service
- TICKET-060: CSV Paste Import Adapter
- TICKET-061: Static HTML Table URL Import Adapter
- TICKET-062: Fixture Import Validation, Matching & Manual Apply
- TICKET-063: Admin Import UI

Exit criteria:

- Admin can paste CSV fixture rows → create import batch → preview grouped outcomes → apply safe rows.
- Admin can enter a static HTML URL → detect tables → select one or more → create batch → preview → apply.
- Club/competition/venue matching works correctly. Unmatched rows are blocked with clear reasons.
- Fixture moves update existing fixtures by home, away, competition, and season.
- Fixture identity supports mapped clubs and explicit one-off team participants without creating permanent clubs.
- Blank import fields never erase existing data.
- Multi-statement fixture writes use `writeBatch()`. No `db.transaction()` in production paths.

### Milestone 3: Public Readiness And Operational Visibility

Purpose: make real fixture data honest and usable in public search and admin operations.

Tickets:

- TICKET-046: Public Fixture Search Readiness
- TICKET-047: General Public Corrections And Admin Queue
- TICKET-048: Travel Cache Admin Visibility
- TICKET-049: Front-End Screenshot Review Harness
- TICKET-050: Public Pyramid Launch Polish

Exit criteria:

- Public search defaults to real fixtures and hides demo fallback unless explicitly enabled.
- Public cards show statuses and data caveats without implying guaranteed availability.
- Users can report fixture, venue, ticket, travel, and club-detail issues.
- Admins can inspect travel cache coverage and staleness.
- Launch readiness review can be repeated with screenshots.

### Post-Operations Enhancement: Weather Risk

Purpose: add forecast-based weather risk badges after the fixture operations foundation is complete.

Ticket:

- TICKET-051: Weather Risk Postponement Warning Enhancement

Plan:

- [docs/weather-risk-enhancement-plan.md](weather-risk-enhancement-plan.md)

Scheduling rule:

- Do not start product integration until TICKET-038, TICKET-040, TICKET-045, and TICKET-046 are complete.
- A small Open-Meteo spike may happen earlier only if it does not change production schema or public UI.

## Out Of Scope For This Sprint

- Normal user accounts.
- Favourite clubs.
- Email alerts.
- Full scraper framework for every source.
- Native app work.
- Affiliate, resale, checkout, queue, CAPTCHA, seat maps, or baskets.
- Automatic correction application.
- Full admin pyramid edge editor unless it blocks mapping or import work.
- Complex analytics dashboards.
- Weather risk badges and forecast ingestion; see the post-operations enhancement plan.
