# Mobile Implementation Plan

> A mobile-first football fixture finder where users can discover upcoming matches by location, date, distance, club, league and ground, with official links as secondary actions.

**Assumptions**
- Current stack: Next.js 15, React 19, App Router, Vitest, Playwright
- Existing public search API: `POST /api/search` with `postcode`, `dateFrom`, `dateTo`, `radiusMiles`
- Native apps consume stable public APIs; no duplicated business logic

**Recommended approach:** React Native/Expo for native apps unless there is a hard native requirement.

---

## Epic 1: Mobile Website MVP

| Ticket | Title | Scope | Acceptance Criteria |
|---|---|---|---|
| WEB-01 | Mobile UX audit and route plan | Audit current public pages, API shape, data fields, missing routes, and responsive issues. Confirm route plan for `/`, `/fixtures`, `/fixtures/[id]`, `/clubs/[slug]`, `/grounds/[slug]`, `/report`. | Notes exist in issue/PR. Required API gaps are listed. No implementation decisions are left implicit. |
| WEB-02 | Mobile fixture view models | Add shared fixture card/detail view models, date filter parsing, fixture grouping by date, sorting, distance formatting, and URL query helpers. | Unit tests cover `today`, `tomorrow`, `this-weekend`, `next-7-days`, ISO date, grouping, sorting, distance formatting. |
| WEB-03 | Mobile-first homepage search | Replace/reshape homepage into mobile-first search with location input, use-my-location, date chips, radius selector, level filter, and primary CTA. | Works at `375px`, `390px`, `430px`; no horizontal scroll; submit navigates to `/fixtures` query params; location denial handled. |
| WEB-04 | Results route and query contract | Create `/fixtures` route that reads query params, normalizes date filters, calls backend search, and renders server/client states cleanly. | `/fixtures?location=SE22&date=this-weekend&radius=25&level=all` works. Bad params show useful errors. |
| WEB-05 | Mobile fixture cards and grouped results | Build `FixtureCard`, `FixtureDateGroup`, and results list grouped by readable date. | Results are cards, not tables. Card priority is kickoff, teams, ground/distance, competition, official info. |
| WEB-06 | Search summary and filter bottom sheet | Add sticky search summary and mobile filter drawer/bottom sheet for location, date, radius, level/competition. | Filters open/close with keyboard and touch. Applying filters updates URL. Escape closes sheet. |
| WEB-07 | Empty, loading, and error states | Add deliberate states for no fixtures, API failure, loading, denied location, missing distance. | Empty state suggests useful actions like increasing radius or broadening date. |
| WEB-08 | Fixture detail page | Add `/fixtures/[id]` with teams, date, kickoff, competition, ground, map preview, official links, last checked/source if available, report issue. | Detail page is readable on phone. No unsupported ticket availability wording. |
| WEB-09 | Public club page | Add `/clubs/[slug]` or ID-backed equivalent with club info, league, ground, official links, upcoming fixtures using same fixture card pattern. | Club page has no mobile table layout and links to fixture/ground pages. |
| WEB-10 | Public ground page | Add `/grounds/[slug]` or ID-backed equivalent with ground name, resident clubs, postcode/address, map preview, upcoming fixtures. | Missing coordinates degrade gracefully. Upcoming fixtures reuse shared card/list components. |
| WEB-11 | Report wrong info flow | Add `/report` and `ReportIssueButton` from fixture, club, and ground pages with prefilled context. | User can submit a short correction report. Submission is stored pending review or isolated behind a clear placeholder if backend gap exists. |
| WEB-12 | Map view abstraction | Add list/map toggle and `FixtureMap` abstraction. Lazy-load map code. | List view works without map JS. Map pins only show fixtures with coordinates. Preview card links to fixture detail. |
| WEB-13 | Mobile navigation polish | Add simple mobile header/menu. Avoid bottom nav until Fixtures, Clubs, and Grounds are all usable. | Navigation works with touch and keyboard. Back paths are clear. |
| WEB-14 | Mobile accessibility pass | Check labels, headings, focus states, button/link semantics, bottom sheet focus/scroll, color contrast, nested interactive elements. | Accessibility checklist passes for core flows. |
| WEB-15 | Mobile performance pass | Avoid eager map loading, keep cards lightweight, debounce location/geocoding, handle large result sets. | Lighthouse/mobile build has no obvious regressions. Map bundle is isolated or lazy. |
| WEB-16 | Mobile E2E and manual QA | Add Playwright mobile viewport coverage for homepage search, results, empty state, detail page, and filter drawer. | Tests run at `390x844`. Manual QA checklist passes at `375px`, `390px`, `430px`. |

## Epic 2: Mobile API Foundation For Apps

| Ticket | Title | Scope | Acceptance Criteria |
|---|---|---|---|
| API-01 | Define public mobile API contract | Document stable JSON contracts for fixture search, fixture detail, club detail, ground detail, and report issue. | Native apps can be built without scraping Next pages. |
| API-02 | Add fixture detail API | Add endpoint for one fixture by ID/slug with official links, venue, coordinates, source/last checked, status. | Native clients can render fixture detail from one request. |
| API-03 | Add club and ground APIs | Add endpoints for club detail/upcoming fixtures and ground detail/upcoming fixtures. | Native clients can render club/ground pages from API responses. |
| API-04 | Add report issue API | Ensure public correction submissions can be created with fixture/club/ground context and remain pending review. | Submission validates input and never auto-applies corrections. |
| API-05 | API versioning and client compatibility | Introduce `/api/mobile/v1/...` or equivalent documented versioning. | Future response changes can be made safely. |
| API-06 | API test coverage | Add tests for search, detail, club, ground, and report endpoints. | Vitest covers happy paths, invalid input, empty data, missing records. |

## Epic 3: Native App Strategy

| Ticket | Title | Scope | Acceptance Criteria |
|---|---|---|---|
| APP-00 | Native approach decision | Decide between React Native/Expo, Capacitor wrapping PWA, or fully native Swift/Kotlin. Recommendation: React Native/Expo unless there is a hard native requirement. | Decision records tradeoffs, maintenance cost, maps, geolocation, deep links, releases. |
| APP-01 | Shared mobile design tokens | Define colors, spacing, typography, button/card styles aligned with mobile website. | iOS and Android screens visually match web without inventing a second product. |
| APP-02 | Shared client API package | Create reusable API client/types for fixture search, fixture detail, club, ground, report issue. | Both apps consume the same contracts and handle API errors consistently. |
| APP-03 | Native app analytics/privacy baseline | Decide minimal analytics/crash reporting and document privacy implications for location use. | Location permission copy and privacy metadata are ready for store review. |

## Epic 4: iPhone App

| Ticket | Title | Scope | Acceptance Criteria |
|---|---|---|---|
| IOS-01 | iOS app scaffold | Create iOS app project using chosen approach, environment config, build scripts, simulator setup. | App launches on iPhone simulator and can call staging/local API. |
| IOS-02 | iOS search screen | Build location/date/radius/level search screen with native geolocation permission handling. | User can search by postcode or current location. Denied permission falls back to manual entry. |
| IOS-03 | iOS fixture results | Build grouped fixture cards, sticky summary, filter sheet, empty/error/loading states. | Results match mobile web hierarchy and wording. |
| IOS-04 | iOS fixture detail | Build fixture detail with ground, map preview/open maps, official links, report issue. | Detail is readable on small iPhones and handles missing optional data. |
| IOS-05 | iOS club and ground pages | Build club and ground detail screens with upcoming fixtures. | Screens reuse fixture card pattern and link between fixture/club/ground. |
| IOS-06 | iOS map view | Add map/list toggle with fixture pins and preview card. | Map code does not block list rendering. Fixtures without coordinates remain visible in list. |
| IOS-07 | iOS report issue flow | Add correction form with fixture/club/ground context. | Submission succeeds/fails with clear confirmation/error states. |
| IOS-08 | iOS deep links | Support opening fixture/club/ground links in app where possible. | Shared links route to correct app screen. |
| IOS-09 | iOS offline/resilience polish | Add request retry, network error states, stale cached last search if desired. | App remains usable under poor network conditions. |
| IOS-10 | iOS release readiness | App icons, splash screen, privacy strings, App Store metadata, TestFlight build. | TestFlight build is installable and passes smoke QA. |

## Epic 5: Android App

| Ticket | Title | Scope | Acceptance Criteria |
|---|---|---|---|
| AND-01 | Android app scaffold | Create Android app project using chosen approach, environment config, emulator setup. | App launches on Android emulator and can call staging/local API. |
| AND-02 | Android search screen | Build location/date/radius/level search with Android location permission handling. | User can search by postcode or current location. Denied permission falls back to manual entry. |
| AND-03 | Android fixture results | Build grouped fixture cards, sticky summary, filter sheet, empty/error/loading states. | Results match mobile web hierarchy and wording. |
| AND-04 | Android fixture detail | Build fixture detail with ground, map preview/open maps, official links, report issue. | Detail handles missing optional data and small-screen layouts. |
| AND-05 | Android club and ground pages | Build club and ground detail screens with upcoming fixtures. | Screens reuse fixture card pattern and link between fixture/club/ground. |
| AND-06 | Android map view | Add map/list toggle with fixture pins and preview card. | Map code does not block list rendering. Fixtures without coordinates remain visible in list. |
| AND-07 | Android report issue flow | Add correction form with fixture/club/ground context. | Submission succeeds/fails with clear confirmation/error states. |
| AND-08 | Android app links | Support opening fixture/club/ground links in app where possible. | Shared links route to correct app screen. |
| AND-09 | Android offline/resilience polish | Add request retry, network error states, stale cached last search if desired. | App remains usable under poor network conditions. |
| AND-10 | Android release readiness | App icon, splash screen, Play Store metadata, privacy/data safety, internal testing build. | Internal testing build is installable and passes smoke QA. |

## Recommended Milestones

| Milestone | Includes | Outcome |
|---|---|---|
| M1 Mobile Web Search | WEB-01 to WEB-07 | Users can search and scan fixture cards on phones. |
| M2 Mobile Web Detail | WEB-08 to WEB-11 | Fixture, club, ground, and report flows work. |
| M3 Mobile Web Polish | WEB-12 to WEB-16 | Map, accessibility, performance, QA. |
| M4 App API Foundation | API-01 to API-06 | Native clients have stable endpoints. |
| M5 Native MVP | APP-00 to APP-03, IOS-01 to IOS-04, AND-01 to AND-04 | Search/results/detail working on both platforms. |
| M6 Native Complete | Remaining iOS/Android tickets | Store-ready apps with club/ground/map/report flows. |

## Product Principles

- Mobile is the default: design for 375px, 390px, 430px first
- Fixture cards, not fixture tables
- Discovery is the main action
- Ticket links are secondary — use "Official info", "Club site", "Match info"
- Avoid "Buy tickets", "Available now", "Sold out" unless genuinely reliable

## Definition of Done

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
