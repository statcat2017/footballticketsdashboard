Below is an **OpenCode-ready implementation plan** for building an effective mobile frontend for the fixture finder.

The assumption is that the product is now:

> A mobile-first football fixture finder where users can discover upcoming matches by location, date, distance, club, league and ground, with official links as secondary actions.

Not a ticket-status tracker. No “available/sold out/general sale” nonsense. Good riddance.

---

# Mobile Frontend Implementation Plan for OpenCode

## 1. Goal

Implement a **mobile-first frontend** for the fixture finder that makes it easy for users to answer:

> “What football is on near me, on this date, within a reasonable distance?”

The first mobile version should prioritise:

1. fast fixture discovery
2. location/date/radius search
3. readable fixture cards
4. map/list switching
5. fixture detail pages
6. club and ground pages that work properly on phones
7. clear “official info” links
8. report wrong info flow

The mobile frontend should not be a squeezed desktop table. It should be built as the primary experience.

---

# 2. Product Principles

OpenCode should follow these throughout the build.

## Mobile is the default

Design for a narrow phone viewport first, then enhance for tablet and desktop.

The core layout should work well at:

```txt
375px wide
390px wide
430px wide
```

Do not build a desktop table and then hide half the columns.

## Fixture cards, not fixture tables

On mobile, fixtures should be shown as cards grouped by date.

Bad mobile pattern:

```txt
Date | Time | Home | Away | Ground | Competition | Distance | Links
```

Good mobile pattern:

```txt
Sat 24 Aug

3:00pm
Dulwich Hamlet v Horsham
Champion Hill · 2.1 miles away
Isthmian Premier

[Details] [Official info]
```

## The main action is discovery

The homepage should make it obvious that the user can search by:

* location
* date
* radius
* level/league

Everything else is supporting structure.

## Ticket links are secondary

The site may include official club/match/ticket links, but it must not imply live ticket availability.

Use wording like:

```txt
Official info
Club site
Match info
```

Avoid:

```txt
Buy tickets
Available now
On sale
```

Unless that data is genuinely reliable.

---

# 3. Main Mobile User Journeys

## Journey A: Find football near me this weekend

1. User opens homepage.
2. Taps **Use my location** or enters postcode/town.
3. Selects **This weekend**.
4. Selects radius.
5. Taps **Find fixtures**.
6. Sees fixture cards grouped by date.
7. Opens a fixture.
8. Views ground, map, official info link and report issue button.

## Journey B: Find fixtures for a specific club

1. User searches for a club.
2. Opens club page.
3. Sees upcoming fixtures.
4. Taps fixture detail.
5. Uses official info link.

## Journey C: Find what is happening at a ground

1. User searches for a ground.
2. Opens ground page.
3. Sees upcoming fixtures at that ground.
4. Views map/address.

## Journey D: Browse fixtures by date

1. User selects Today, Tomorrow, This Weekend, Next 7 Days, or custom date.
2. User optionally applies location/radius.
3. Results update.

---

# 4. Required Screens

## 4.1 Mobile Home / Search Screen

Purpose:

> Start a fixture search quickly.

### Required elements

* Page title
* Short explanation
* Location input
* “Use my location” button
* Date quick filters
* Radius selector
* Level/league filter
* Primary **Find fixtures** button

### Suggested layout

```txt
Find football near you

Search upcoming football fixtures by location, date and distance.

[Use my location]

or

[Enter town or postcode]

When?
[Today] [Tomorrow] [This weekend] [Next 7 days]

Distance
[5 mi] [10 mi] [25 mi] [50 mi]

Level
[All] [Pro] [Non-league]

[Find fixtures]
```

### Behaviour

* If user grants geolocation permission, use browser geolocation.
* If user denies geolocation, keep manual location input visible.
* If user enters a postcode/town, geocode it using existing backend/API if available.
* If geocoding is not available yet, implement the UI with a clearly isolated placeholder function.
* Date quick filters should map to query params.
* Form submit should navigate to the results page with query parameters.

### Example query params

```txt
/fixtures?location=SE22&date=this-weekend&radius=25&level=all
```

or:

```txt
/fixtures?lat=51.454&lng=-0.072&date=this-weekend&radius=25&level=all
```

---

## 4.2 Mobile Fixture Results Screen

Purpose:

> Let users scan upcoming fixtures quickly.

### Required elements

* Sticky search summary
* Change filters button
* List/map toggle
* Results grouped by date
* Fixture cards
* Empty state
* Loading state
* Error state

### Suggested top bar

```txt
London · This weekend · 25 miles
[Change]
```

### Fixture groups

```txt
Saturday 24 August

3:00pm
Dulwich Hamlet v Horsham
Champion Hill · 2.1 miles
Isthmian Premier
[Details] [Official info]

3:00pm
Bromley v Walsall
Hayes Lane · 9.4 miles
League Two
[Details] [Official info]
```

### Required sorting

Default sort:

1. date
2. kickoff time
3. distance, if location is available
4. competition level, optional tiebreaker

### Required filter drawer / bottom sheet

On mobile, filters should open in a bottom sheet or full-screen panel.

Fields:

* location
* date
* radius
* competition/level
* home/away/all, optional
* show postponed fixtures toggle, optional

### Empty state

Do not just show “No results”.

Use actionable suggestions:

```txt
No fixtures found within 10 miles this Saturday.

Try increasing the radius or searching the full weekend.
[Increase to 25 miles]
[Search this weekend]
```

### Error state

```txt
Couldn’t load fixtures.

Please try again. If this keeps happening, report the issue.
[Retry]
```

---

## 4.3 Mobile Fixture Detail Screen

Purpose:

> Help the user decide whether this match is relevant and where to get official information.

### Required elements

* Home team
* Away team
* Competition
* Date
* Kickoff time
* Ground
* Address/postcode
* Map preview
* Distance from searched location, if available
* Official club/match/info links
* Source/last checked info, if available
* Report wrong info button

### Suggested layout

```txt
Dulwich Hamlet v Horsham

Saturday 24 August
3:00pm
Isthmian Premier

Champion Hill
Edgar Kail Way, London SE22

[Open map]

Official links
[Club site]
[Match info]

Last checked: 20 May 2026

[Report wrong info]
```

### Important wording

Use:

```txt
Official info
Club site
Match page
```

Avoid:

```txt
Buy tickets
Available tickets
Ticket status
```

Unless the data source genuinely supports it.

---

## 4.4 Mobile Map View

Purpose:

> Help users visually discover nearby fixtures.

### Required elements

* Map
* Fixture pins
* Selected fixture preview card
* List/map toggle
* Same filters as list view
* Current searched location marker, if available

### Behaviour

* Tapping a pin opens a bottom preview card.
* Preview card shows:

  * kickoff time
  * teams
  * ground
  * distance
  * Details button
* The map should not be the only way to browse. It is secondary to the list.

### Suggested selected fixture preview

```txt
3:00pm
Bromley v Walsall
Hayes Lane · 9.4 miles
League Two

[Details]
```

### Implementation note

If map integration is not already present, OpenCode should implement the layout and abstraction first:

```ts
<FixtureMap fixtures={fixtures} selectedFixtureId={...} />
```

Then wire it to the chosen map provider separately.

Do not hard-code business logic inside the map component.

---

## 4.5 Mobile Club Page

Purpose:

> Show the club’s upcoming fixtures and useful official links.

### Required elements

* Club name
* League/division
* Home ground
* Upcoming fixtures
* Official website
* Official info/ticket page if available
* Ground link
* Report wrong info button

### Suggested layout

```txt
Bromley

League Two
Home ground: Hayes Lane

Upcoming fixtures

Sat 24 Aug · 3:00pm
Bromley v Walsall
Hayes Lane

Tue 27 Aug · 7:45pm
Bromley v Gillingham
Hayes Lane

Official links
[Club website]
[Fixture info]
```

---

## 4.6 Mobile Ground Page

Purpose:

> Show what fixtures are happening at a specific ground.

### Required elements

* Ground name
* Resident club or clubs
* Address
* Postcode
* Map preview
* Upcoming fixtures at ground
* Official club links where relevant
* Report wrong info button

### Suggested layout

```txt
Hayes Lane

Home of Bromley
London BR2

[Open map]

Upcoming fixtures

Sat 24 Aug · 3:00pm
Bromley v Walsall

Tue 27 Aug · 7:45pm
Bromley v Gillingham
```

---

# 5. Component Architecture

OpenCode should implement reusable mobile-first components.

## Core components

```txt
MobilePageShell
SearchHero
LocationSearch
UseMyLocationButton
DateQuickFilters
RadiusSelector
LevelFilter
FixtureResultsHeader
FilterBottomSheet
FixtureDateGroup
FixtureCard
FixtureCompactRow
FixtureMapToggle
FixtureMap
FixturePreviewCard
FixtureDetailHeader
GroundSummaryCard
OfficialLinksPanel
ReportIssueButton
EmptyFixturesState
LoadingFixturesState
ErrorFixturesState
```

## Component responsibilities

### `SearchHero`

Used on the homepage.

Should contain:

* heading
* short intro
* location search
* date filters
* radius filter
* submit button

Should not fetch fixture data itself.

---

### `LocationSearch`

Handles:

* typed location
* postcode/town text
* validation
* optional geocoding trigger

Should not directly navigate.

Inputs:

```ts
value: string
onChange: (value: string) => void
onResolvedLocation?: (location: ResolvedLocation) => void
```

---

### `UseMyLocationButton`

Handles browser geolocation.

States:

* idle
* requesting
* success
* denied
* unavailable
* error

Should return coordinates to parent.

---

### `DateQuickFilters`

Options:

```txt
Today
Tomorrow
This weekend
Next 7 days
Pick date
```

Should map to a normalized date filter value.

---

### `FixtureCard`

The most important mobile component.

Required display fields:

* kickoff time
* home team
* away team
* ground
* distance, if available
* competition
* status only if fixture is postponed/cancelled

Do not display too much metadata.

Good card:

```txt
3:00pm
Dulwich Hamlet v Horsham
Champion Hill · 2.1 miles
Isthmian Premier
[Details] [Official info]
```

Bad card:

```txt
Fixture ID: 4472
Competition ID: 8
Source: Import
Last Modified: ...
Ticket Link: ...
Venue Type: ...
```

That belongs in admin, not mobile UI.

---

### `FilterBottomSheet`

Used from results page.

Fields:

* location
* date
* radius
* level
* competition
* sort
* clear filters
* apply filters

Must be thumb-friendly.

---

### `OfficialLinksPanel`

Shows official external links.

Possible links:

* club website
* match page
* fixture page
* ticket/info page

Labels should be careful:

```txt
Official info
Club website
Match page
```

Avoid unsupported claims.

---

### `ReportIssueButton`

Should open a report form or navigate to one.

Issue categories:

```txt
Wrong kickoff time
Wrong ground
Fixture postponed/cancelled
Fixture missing
Wrong club
Wrong competition
Broken official link
Other
```

---

# 6. Data Requirements

OpenCode should inspect the existing data model and map it to the mobile frontend.

The frontend should be able to consume fixtures with this shape, or adapt the existing shape into this view model.

## Fixture view model

```ts
type FixtureCardViewModel = {
  id: string;
  date: string; // ISO date
  kickoffTime: string | null;
  homeTeam: {
    id: string;
    name: string;
    slug: string;
  };
  awayTeam: {
    id: string;
    name: string;
    slug: string;
  };
  competition: {
    id: string;
    name: string;
    level?: number | null;
  };
  ground: {
    id: string;
    name: string;
    slug: string;
    postcode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  distanceMiles?: number | null;
  officialLinks?: {
    label: string;
    url: string;
    type: "club" | "match" | "info" | "other";
  }[];
  status?: "scheduled" | "postponed" | "cancelled" | "completed";
};
```

## Club view model

```ts
type ClubPageViewModel = {
  id: string;
  name: string;
  slug: string;
  leagueName?: string;
  ground?: {
    id: string;
    name: string;
    slug: string;
  };
  officialLinks?: {
    label: string;
    url: string;
    type: "website" | "fixtures" | "info" | "other";
  }[];
  upcomingFixtures: FixtureCardViewModel[];
};
```

## Ground view model

```ts
type GroundPageViewModel = {
  id: string;
  name: string;
  slug: string;
  address?: string;
  postcode?: string;
  latitude?: number | null;
  longitude?: number | null;
  residentClubs?: {
    id: string;
    name: string;
    slug: string;
  }[];
  upcomingFixtures: FixtureCardViewModel[];
};
```

---

# 7. URL and Routing Plan

OpenCode should make the mobile frontend shareable and SEO-friendly.

## Suggested routes

```txt
/
Homepage search

/fixtures
Fixture search results

/fixtures/[fixtureSlugOrId]
Fixture detail page

/clubs
Club search/browse

/clubs/[clubSlug]
Club page

/grounds
Ground search/browse

/grounds/[groundSlug]
Ground page

/report
Report wrong info form
```

## Results query params

```txt
/fixtures?location=London&date=this-weekend&radius=25&level=all
```

or:

```txt
/fixtures?lat=51.5072&lng=-0.1276&date=2026-08-15&radius=25
```

## Date params

Support:

```txt
today
tomorrow
this-weekend
next-7-days
YYYY-MM-DD
```

Internally normalize these into date ranges.

---

# 8. Responsive Layout Rules

## Breakpoints

Use approximately:

```txt
0–640px       Mobile
641–1024px    Tablet
1025px+       Desktop
```

## Mobile layout

* Single column
* Cards
* Bottom sheet filters
* Bottom or sticky top navigation
* Large touch targets
* Minimal metadata

## Tablet layout

* Cards in one or two columns
* Map/list side-by-side optional
* Filters can be side drawer

## Desktop layout

* List/table hybrid allowed
* Map alongside list allowed
* More metadata visible

But desktop should be enhancement, not the source of truth.

---

# 9. Navigation

## Mobile navigation

For v1, use simple navigation.

Suggested bottom nav:

```txt
Fixtures | Map | Clubs
```

But only use bottom nav if these routes are actually ready.

Otherwise use a simple top header:

```txt
[Logo] [Menu]
```

with menu items:

```txt
Find fixtures
Clubs
Grounds
Report issue
```

## Recommendation

For the first implementation, keep navigation simple:

* header with logo/name
* menu button
* clear back links
* sticky results summary

Do not overbuild app-like navigation until the main flows are working.

---

# 10. Interaction Design Details

## Touch targets

All tappable controls should be at least about 44px high.

This applies to:

* buttons
* filter chips
* fixture cards if clickable
* map/list toggles
* date filters
* radius selectors

## Sticky controls

On results pages, keep a compact search summary visible:

```txt
London · This weekend · 25 mi
[Change]
```

This helps users understand what they are looking at.

## Filter chips

Use chips for selected filters:

```txt
London   This weekend   25 miles   All levels
```

Tapping **Change** opens the filter bottom sheet.

## Date grouping

Group fixtures by readable date:

```txt
Today
Tomorrow
Saturday 24 August
Sunday 25 August
```

## Distance display

If distance is known:

```txt
2.1 miles away
```

If not known:

```txt
Distance unavailable
```

Do not hide the fixture because distance is missing unless the user specifically searched by radius.

---

# 11. States to Implement

OpenCode must implement these states deliberately.

## Loading states

Homepage:

```txt
Finding your location...
```

Results:

```txt
Loading fixtures...
```

Use skeleton cards if the project already has a skeleton component.

## Empty states

Example:

```txt
No fixtures found within 10 miles this Saturday.

Try increasing the radius or searching the full weekend.
```

Actions:

```txt
Increase radius
Search this weekend
Clear filters
```

## Error states

Example:

```txt
Couldn’t load fixtures.

Please try again.
```

Actions:

```txt
Retry
Report issue
```

## Location denied state

Example:

```txt
Location access was blocked.

Enter a town or postcode instead.
```

## Missing coordinates state

For clubs/grounds with no lat/lng:

```txt
Map unavailable for this ground.
```

Do not break the page.

---

# 12. Accessibility Requirements

OpenCode should include basic accessibility work from the start.

## Required

* Semantic headings
* Buttons are actual `<button>` elements
* Links are actual `<a>` elements
* Form inputs have labels
* Cards should not contain nested invalid clickable elements
* Focus states visible
* Sufficient colour contrast
* Map pins must not be the only way to access fixtures
* Filter bottom sheet must be keyboard closable
* Escape should close modal/bottom sheet
* Body scroll should behave correctly when sheet is open

## Fixture card accessibility

If the whole card is clickable, avoid also making the buttons inside it cause nested interactive chaos.

Better:

* card content is static
* explicit buttons/links at bottom

---

# 13. Performance Requirements

Mobile performance matters more than desktop polish.

## Required

* Avoid loading map JavaScript until the map tab/view is opened
* Keep fixture cards lightweight
* Paginate or virtualize if results can be very large
* Avoid huge badge/logo images in fixture cards
* Use responsive image sizes where logos exist
* Debounce location search/geocoding
* Cache fixture results where appropriate

## Map performance

If there are many fixtures:

* cluster markers, or
* limit map pins to visible date/radius results

Do not render hundreds of pins unnecessarily.

---

# 14. Implementation Phases for OpenCode

## Phase 0: Inspect existing app

OpenCode should first inspect:

```txt
package.json
app/ or pages/
components/
lib/
src/
data/
types/
API routes
fixture-related models
existing CSS/Tailwind setup
existing tests
```

Then identify:

* framework: Next.js, React Router, etc.
* styling system
* current data fetch approach
* existing fixture model
* current desktop pages
* map provider, if any
* test tooling

Deliverable:

```txt
Brief implementation notes in a new docs/mobile-frontend-plan.md file, or update existing project plan if one exists.
```

If the repo already has planning conventions, follow them.

---

## Phase 1: Create mobile view models and utilities

Add or update:

```txt
types/fixture.ts
lib/fixtures/view-models.ts
lib/fixtures/date-filters.ts
lib/fixtures/distance.ts
```

### Required utility behaviour

Date filter parser:

```ts
parseDateFilter("today")
parseDateFilter("tomorrow")
parseDateFilter("this-weekend")
parseDateFilter("next-7-days")
parseDateFilter("2026-08-15")
```

Distance formatter:

```ts
formatDistanceMiles(2.123) // "2.1 miles"
formatDistanceMiles(null) // null or "Distance unavailable"
```

Fixture grouping:

```ts
groupFixturesByDate(fixtures)
```

Sorting:

```ts
sortFixturesForMobile(fixtures)
```

### Acceptance criteria

* Fixtures can be transformed into mobile card view models.
* Date filters are normalized.
* Fixtures can be grouped by date.
* Results are sorted predictably.

---

## Phase 2: Build mobile search homepage

Create or update homepage with:

```txt
SearchHero
LocationSearch
UseMyLocationButton
DateQuickFilters
RadiusSelector
LevelFilter
```

### Behaviour

* User can enter location manually.
* User can select date filter.
* User can select radius.
* User can submit search.
* Submit navigates to `/fixtures` with query params.
* Geolocation fills lat/lng query params where available.

### Acceptance criteria

At 390px width:

* no horizontal scroll
* primary CTA visible
* all controls tappable
* layout readable
* location denial handled

---

## Phase 3: Build fixture results list

Create or update:

```txt
/fixtures
FixtureResultsPage
FixtureResultsHeader
FilterBottomSheet
FixtureDateGroup
FixtureCard
EmptyFixturesState
LoadingFixturesState
ErrorFixturesState
```

### Behaviour

* Reads query params.
* Fetches matching fixtures.
* Groups fixtures by date.
* Shows cards.
* Change button opens filters.
* Applying filters updates URL.
* Empty state suggests next actions.

### Acceptance criteria

At 390px width:

* results are cards, not table rows
* fixtures are grouped by date
* filter drawer works
* page can be used one-handed
* no unsupported ticket status language appears

---

## Phase 4: Fixture detail page

Create or update:

```txt
/fixtures/[id-or-slug]
FixtureDetailPage
FixtureDetailHeader
GroundSummaryCard
OfficialLinksPanel
ReportIssueButton
```

### Behaviour

* Shows core fixture information.
* Shows ground info.
* Shows official links.
* Shows map preview if ground coordinates exist.
* Shows report issue button.

### Acceptance criteria

* Fixture detail can be understood without needing desktop.
* Official links are clearly secondary.
* Missing data is handled gracefully.

---

## Phase 5: Club page mobile optimisation

Create or update:

```txt
/clubs/[slug]
ClubPage
ClubHeader
ClubUpcomingFixtures
OfficialLinksPanel
```

### Behaviour

* Shows club info.
* Shows upcoming fixtures as mobile cards.
* Links to fixture detail pages.
* Links to ground page.
* Links to official club/info pages.

### Acceptance criteria

* Club page works well on phone.
* Upcoming fixtures are easy to scan.
* No table layout on mobile.

---

## Phase 6: Ground page mobile optimisation

Create or update:

```txt
/grounds/[slug]
GroundPage
GroundHeader
GroundMapPreview
GroundUpcomingFixtures
```

### Behaviour

* Shows ground address/postcode.
* Shows map preview where possible.
* Shows fixtures at the ground.
* Links to resident club(s).

### Acceptance criteria

* Ground page works well on phone.
* Missing coordinates do not break the page.
* Upcoming fixtures use same fixture card component.

---

## Phase 7: Map view

Only do this after list results work.

Create or update:

```txt
FixtureMap
FixtureMapView
FixturePreviewCard
```

### Behaviour

* Map is accessible from results page.
* Map loads only when needed.
* Fixture pins appear for fixtures with coordinates.
* Tapping a pin opens preview card.
* Preview links to fixture detail.

### Acceptance criteria

* Map does not block list view performance.
* Fixtures without coordinates still appear in list.
* Map view is not the only navigation path.

---

## Phase 8: Report wrong info flow

Create or update:

```txt
ReportIssueButton
ReportIssueForm
/report
```

### Categories

```txt
Wrong kickoff time
Wrong ground
Fixture postponed/cancelled
Fixture missing
Wrong club
Wrong competition
Broken official link
Other
```

### Behaviour

* From fixture page, pre-fill fixture ID.
* From club page, pre-fill club ID.
* From ground page, pre-fill ground ID.
* Submit to existing backend/email/queue if available.
* If backend not available, implement UI and isolate submit handler.

### Acceptance criteria

* User can report fixture issues from mobile.
* Form is short.
* Confirmation appears after submission.
* Failure is handled.

---

# 15. Styling Guidelines

## Visual priority

Fixture cards should emphasise:

1. kickoff time
2. teams
3. ground/distance
4. competition
5. action links

## Avoid

* tiny badges everywhere
* huge club crests in cards
* cramped text
* three-column mobile layouts
* hidden horizontal overflow
* excessive metadata
* desktop nav forced onto mobile

## Recommended card spacing

Use generous vertical padding.

Example structure:

```txt
Card
  Time
  Teams
  Ground · Distance
  Competition
  Actions
```

## Suggested visual hierarchy

```txt
Time: small but prominent
Teams: largest text on card
Ground/distance: secondary text
Competition: muted chip or small text
Actions: clear buttons/links
```

---

# 16. Testing Plan

OpenCode should add or update tests where the existing project supports them.

## Unit tests

For:

```txt
date filter parsing
fixture grouping
fixture sorting
distance formatting
query param creation
```

## Component tests

For:

```txt
FixtureCard
DateQuickFilters
RadiusSelector
EmptyFixturesState
FilterBottomSheet
OfficialLinksPanel
```

## E2E tests

If Playwright/Cypress exists, add mobile viewport tests.

Suggested scenarios:

### Scenario 1: Search this weekend

```txt
Given I am on the homepage
When I enter "London"
And I select "This weekend"
And I choose "25 miles"
And I submit
Then I see fixture results grouped by date
```

### Scenario 2: Empty result

```txt
Given I search an area/date with no fixtures
Then I see an empty state with actions to increase radius or broaden date
```

### Scenario 3: Fixture detail

```txt
Given I am viewing fixture results
When I open a fixture
Then I see teams, kickoff, competition, ground and official links
```

### Scenario 4: Mobile layout

Use viewport:

```txt
390x844
```

Assert:

* no horizontal scroll
* fixture cards are visible
* filter button opens bottom sheet
* primary CTA is visible

---

# 17. Manual QA Checklist

OpenCode should run through this manually after implementation.

## Mobile homepage

* [ ] Works at 375px width
* [ ] Location input is usable
* [ ] Use my location handles denied permission
* [ ] Date chips are tappable
* [ ] Radius options are tappable
* [ ] Submit navigates correctly
* [ ] No horizontal scroll

## Results page

* [ ] Search summary visible
* [ ] Fixtures grouped by date
* [ ] Fixture cards readable
* [ ] Filter drawer opens/closes
* [ ] Empty state helpful
* [ ] Loading state present
* [ ] Error state present
* [ ] List/map toggle works if map is implemented

## Fixture detail

* [ ] Teams and time obvious
* [ ] Ground/address visible
* [ ] Official links visible
* [ ] Report wrong info visible
* [ ] Missing optional data handled

## Club page

* [ ] Upcoming fixtures readable
* [ ] Ground link works
* [ ] Official links work
* [ ] Mobile spacing is good

## Ground page

* [ ] Address/postcode visible
* [ ] Map preview works or degrades gracefully
* [ ] Upcoming fixtures readable

## Language

* [ ] No unsupported ticket availability claims
* [ ] No “available now”
* [ ] No “sold out”
* [ ] No “buy tickets” unless genuinely appropriate
* [ ] Use “official info” or “club site” instead

---

# 18. Definition of Done

The mobile frontend work is done when:

1. A user can search for fixtures by location, date and radius on mobile.
2. Results appear as grouped fixture cards.
3. Fixture detail pages are readable on mobile.
4. Club pages show upcoming fixtures clearly.
5. Ground pages show upcoming fixtures clearly.
6. Official links are available as secondary actions.
7. Users can report wrong fixture information.
8. Empty, loading and error states exist.
9. The app works at 375px, 390px and 430px wide.
10. There is no horizontal scrolling.
11. The site does not claim live ticket status.
12. Tests or documented manual QA cover the main flows.

---

# 19. Suggested OpenCode Task Prompt

You can give OpenCode something like this:

```txt
Implement a mobile-first frontend for the football fixture finder.

The product is now focused on fixture discovery, not ticket status. Do not build or display live ticket availability features. Ticket/club links should be secondary and labelled as "Official info", "Club site", or "Match info", not "Available", "Sold out", or "Buy tickets".

First inspect the existing project structure, data models, routes, components, styling system and tests. Then implement the mobile-first flow in phases:

1. Add mobile fixture view models and utilities for date filters, fixture grouping, sorting and distance formatting.
2. Build a mobile-first homepage search flow with location input, use-my-location, date quick filters, radius selector, level filter and a Find Fixtures CTA.
3. Build the /fixtures results page using mobile fixture cards grouped by date, with a sticky search summary and a filter bottom sheet.
4. Build or update fixture detail pages to show teams, kickoff, competition, ground, official links and report wrong info.
5. Optimise club pages for mobile, showing upcoming fixtures using the same FixtureCard component.
6. Optimise ground pages for mobile, showing address/map preview and upcoming fixtures.
7. Add map view only after the list view works, and lazy-load map code if possible.
8. Add or update report wrong info flow with fixture-focused categories.
9. Add tests for date filters, fixture grouping, sorting, distance formatting and key mobile components if the project has a test framework.
10. Manually QA at 375px, 390px and 430px widths.

Follow existing code conventions. Avoid large rewrites unless necessary. Prefer small, reviewable commits. Do not invent a second design system. Reuse existing components where sensible, but replace mobile tables with proper cards. Ensure there is no horizontal scroll on mobile.
```

---

# 20. Suggested OpenCode Review Prompt

After implementation, run a second pass with a review agent/model:

```txt
Review the mobile frontend implementation for the football fixture finder.

Check specifically for:

1. Mobile usability at 375px, 390px and 430px widths.
2. Whether fixture results use cards rather than desktop tables.
3. Whether homepage search is simple and focused.
4. Whether date, location and radius filters work through query params.
5. Whether fixture cards prioritise kickoff time, teams, ground, distance and competition.
6. Whether fixture detail pages are readable and useful on mobile.
7. Whether club and ground pages reuse the fixture card pattern.
8. Whether empty, loading and error states are implemented.
9. Whether geolocation denial is handled gracefully.
10. Whether map code is lazy-loaded or at least isolated.
11. Whether there are unsupported ticket-status claims.
12. Whether accessibility basics are met: labels, buttons, focus states, no nested interactive elements.
13. Whether there is horizontal overflow.
14. Whether tests were added or existing tests updated.

Return:
- critical issues
- recommended improvements
- nice-to-have improvements
- files that need follow-up changes
```

---

# 21. Suggested File/Component Checklist

OpenCode should end up with something roughly like this, adjusted to your actual repo structure:

```txt
components/mobile/SearchHero.tsx
components/mobile/LocationSearch.tsx
components/mobile/UseMyLocationButton.tsx
components/mobile/DateQuickFilters.tsx
components/mobile/RadiusSelector.tsx
components/mobile/LevelFilter.tsx
components/fixtures/FixtureCard.tsx
components/fixtures/FixtureDateGroup.tsx
components/fixtures/FixtureResultsHeader.tsx
components/fixtures/FilterBottomSheet.tsx
components/fixtures/FixtureDetailHeader.tsx
components/fixtures/OfficialLinksPanel.tsx
components/fixtures/EmptyFixturesState.tsx
components/fixtures/LoadingFixturesState.tsx
components/fixtures/ErrorFixturesState.tsx
components/fixtures/FixtureMap.tsx
components/grounds/GroundSummaryCard.tsx
components/report/ReportIssueButton.tsx
components/report/ReportIssueForm.tsx

lib/fixtures/date-filters.ts
lib/fixtures/group-fixtures.ts
lib/fixtures/sort-fixtures.ts
lib/fixtures/distance.ts
lib/fixtures/view-models.ts

app/fixtures/page.tsx
app/fixtures/[id]/page.tsx
app/clubs/[slug]/page.tsx
app/grounds/[slug]/page.tsx
app/report/page.tsx
```

If the project uses `pages/` instead of `app/`, adapt accordingly.

---

# 22. The Absolute Priority

If OpenCode only gets one thing right, make it this:

> A user on a phone can enter where they are, pick a date, choose a radius, and see a clean list of nearby fixtures grouped by date.

Everything else is secondary.

No one cares if the nav menu has a tasteful hover state if the fixture results look like a railway timetable printed on a postage stamp.
