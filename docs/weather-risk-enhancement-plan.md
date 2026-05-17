# Weather Risk Enhancement Plan

## Goal

Add weather-aware fixture warnings after the fixture operations foundation is complete.

The feature should ingest weather forecast data from a free API, calculate risk that weather may affect a fixture, and show a cautious public warning when heavy rain, storms, or freezing conditions could make a game vulnerable to postponement or matchday disruption.

This is an enhancement after fixture ingestion, fixture admin, public badge display, and venue metadata are in place. It should not block the core fixture operations launch.

## Product Principle

Weather flags are advisory, not official postponement predictions.

Public copy should say `weather risk`, not `postponement risk`. Users should be encouraged to check with the club or league before travelling.

Most fixtures should have no public weather badge. A green/low-risk state can exist in the database and admin views, but public fixture cards should show weather only when there is meaningful yellow, amber, or red risk.

## User-Facing Behaviour

### Scheduled Or Unknown Fixtures

- Show no weather badge when risk is green or unavailable.
- Show a compact badge when risk is yellow, amber, or red.
- Use cautious copy such as:
  - `Weather risk: yellow · frost risk`
  - `Weather risk: amber · heavy rain forecast`
  - `Weather risk: red · high winds forecast`
- Do not change default fixture sorting in v1.
- Do not hide risky fixtures in v1.

### Postponed Or Cancelled Fixtures

- Continue to show postponed and cancelled fixture status according to the public fixture readiness plan.
- If the fixture is postponed or cancelled and weather risk was high, infer a weather-related context cautiously.
- Use copy such as `Postponed; weather risk was high (rain)`.
- Do not state `Postponed due to rain` unless a future explicit postponement-reason source confirms that cause.

## Risk Levels

Store five states:

| Level | Meaning | Public Display |
| --- | --- | --- |
| `green` | Forecast checked and low weather risk | Hidden by default |
| `yellow` | Mild weather risk | Show compact badge |
| `amber` | Moderate weather risk | Show compact badge |
| `red` | Severe weather risk | Show compact badge |
| `unavailable` | No usable forecast, missing location, outside horizon, or provider failure | Hidden publicly; visible in admin |

## Hazards

Version 1 should evaluate three hazards:

- Rain
- Frost/freezing
- Storms, including thunder and high sustained wind

Each hazard should be scored independently. The fixture-level risk is the highest hazard severity.

If multiple hazards tie, display priority is:

1. Storm
2. Frost
3. Rain

Store all contributing hazards for admin explanation, but display only the dominant reason on public cards.

## Forecast Provider

Use Open-Meteo as the first provider.

Reasons:

- Free and keyless.
- Supports latitude/longitude forecast lookups.
- Provides hourly data suitable for match-time calculations.
- Includes precipitation, temperature, weather codes, and wind data.
- Fits the project rule that provider failures should not block search.

The implementation should still store provider metadata so another weather source can be added later.

## Forecast Horizon

Calculate weather risk only when provider forecast data exists.

Fixtures outside the forecast horizon should be `unavailable`, not green. Public UI should not imply weather is safe for fixtures too far in the future.

## Caching And Refresh

Weather should be precomputed and cached. Public search should read cached risk only.

Search must not call the weather API directly.

Recommended refresh cadence:

- Refresh all eligible upcoming fixtures every 6 hours.
- Refresh fixtures in the next 24 hours more frequently, around every 1 to 2 hours, when scheduled jobs are available.
- Provide a manual refresh command first if scheduled jobs are not ready.

Eligible fixtures:

- Future scheduled fixtures.
- Future unknown-status fixtures.
- Future postponed or cancelled fixtures, so inferred weather context can be shown cautiously.
- Only fixtures within the provider forecast horizon.

## Cache Model

Use two layers:

1. Venue-hour forecast cache.
2. Fixture-level derived risk snapshot.

Venue-hour caching avoids duplicate provider calls for multiple fixtures at the same ground and forecast hour.

Fixture-level snapshots preserve the calculated risk shown to users and make admin review easier.

## Proposed Schema

Add these tables after the fixture foundation lands.

### `weather_forecast_cache`

Purpose: store normalized hourly forecast data by venue and forecast hour.

Suggested fields:

- `id`
- `venue_id`
- `forecast_hour`
- `provider`
- `fetched_at`
- `expires_at`
- `temperature_c`
- `precipitation_mm`
- `weather_code`
- `sustained_wind_mph`
- `raw_json` optional, capped

Suggested uniqueness:

- `venue_id`, `forecast_hour`, `provider`

### `fixture_weather_risks`

Purpose: store derived weather risk for a fixture.

Suggested fields:

- `fixture_id`
- `risk_level`
- `dominant_hazard`
- `hazards_json`
- `reason`
- `rule_version`
- `forecast_fetched_at`
- `calculated_at`
- `unavailable_reason`

### Venue Weather Metadata

Add venue metadata to support risk tuning:

- `weather_sensitivity`: `unknown`, `normal`, `poor_drainage`, `good_drainage`
- `surface_type`: `unknown`, `grass`, `artificial`
- `frost_mitigation`: `unknown`, `none`, `undersoil_heating`

Defaults should be neutral or unknown. Do not assume a venue has undersoil heating or artificial surface without data.

## Risk Rules V1

Rules should be versioned constants in code.

Store `rule_version` on each derived risk row so historic risk calculations are explainable after thresholds change.

Do not build admin-editable threshold UI in v1.

### Rain Risk

Rain risk should consider cumulative rainfall in the 48 hours before kickoff.

Rain forecast during the event window should increase risk.

Event window:

- 2 hours before kickoff to 2 hours after kickoff.

Initial configurable thresholds:

| Level | 48h Rainfall |
| --- | ---: |
| Yellow | 10mm or more |
| Amber | 20mm or more |
| Red | 35mm or more |

If rain is forecast during the event window, increase the rain risk by one level where appropriate.

Venue modifiers:

- Poor drainage may increase rain risk.
- Good drainage may reduce rain risk.
- Artificial surface should reduce rain risk, but not storm risk.

### Frost Risk

Frost risk should use two signals:

- Previous overnight low.
- Match-day daytime high before kickoff.

The key condition is not just whether temperature falls below freezing, but whether the pitch is likely to thaw before kickoff.

Initial configurable thresholds:

| Level | Overnight Low | Daytime High Before Kickoff |
| --- | ---: | ---: |
| Yellow | <= 0°C | <= 4°C |
| Amber | <= -2°C | <= 3°C |
| Red | <= -4°C | <= 2°C, or below freezing through kickoff |

Venue modifiers:

- Confirmed undersoil heating suppresses normal frost risk.
- Artificial surface suppresses or strongly reduces frost risk.
- Unknown mitigation gives no benefit.

### Storm Risk

Storm risk should include thunderstorm forecast codes and sustained wind.

Sustained wind thresholds:

| Level | Sustained Wind Near Kickoff |
| --- | ---: |
| Yellow | 30mph or more |
| Amber | 40mph or more |
| Red | 50mph or more |

Thunderstorm provider weather codes can raise storm risk independently of wind.

Storm risk should not be reduced by artificial surface, undersoil heating, or pitch drainage.

## Public Search Response

Add a structured `weatherRisk` object to fixture search results rather than only appending warning strings.

Suggested shape:

```ts
interface FixtureWeatherRisk {
  level: "green" | "yellow" | "amber" | "red" | "unavailable";
  dominantHazard: "rain" | "frost" | "storm" | null;
  hazards: Array<"rain" | "frost" | "storm">;
  reason: string | null;
  forecastFetchedAt: string | null;
  source: string | null;
  unavailableReason: string | null;
}
```

Public components should render yellow, amber, and red only.

Admin components can show green and unavailable states.

## Admin Surfaces

Add weather risk to fixture admin:

- Risk level column.
- Dominant hazard column.
- Forecast fetched time.
- Filters for yellow, amber, red, stale, and unavailable.

Add a dedicated weather dashboard:

- Upcoming red and amber fixtures.
- Stale forecast rows.
- Missing forecasts.
- Missing venue location issues.
- Provider failures.
- Last refresh run status.
- Rule version currently in use.

Weather provider failures should go to weather dashboard/logs, not import review.

## Missing Data Behaviour

If a fixture has no usable venue coordinates:

- Weather risk is `unavailable`.
- `unavailable_reason` should be `missing_location`.
- Public search should follow the fixture operations plan and hide fixtures with unusable venue locations.
- Admin weather and data-quality surfaces should show the missing location issue.

If the forecast provider fails:

- Search still works.
- Public card shows no weather badge.
- Admin weather dashboard shows the failure or stale status.

## Dependencies

This enhancement should be scheduled after the fixture operations readiness work.

Required dependencies:

| Dependency | Why It Is Needed |
| --- | --- |
| TICKET-038 | Fixture date/time fields and provenance are needed for forecast windows and explainability |
| TICKET-040 | Venue coordinate precision and venue metadata are needed for weather lookup and risk modifiers |
| TICKET-045 | Fixture admin CRUD and preview are needed for admin weather display and review |
| TICKET-046 | Public fixture badges and warning patterns are needed for weather risk display |
| Scheduled/manual refresh path | Forecasts must be refreshed outside public search requests |

Related dependencies:

| Dependency | Why It Helps |
| --- | --- |
| TICKET-041 | Data-quality dashboard can surface venues with missing location data |
| TICKET-048 | Travel/weather admin patterns can share operational visibility conventions |
| TICKET-049 | Screenshot review harness can validate public weather badges on mobile and desktop |

## Enhancement Tickets

Initial implementation should be tracked by TICKET-051.

TICKET-051 may be split later into smaller implementation tickets:

- Weather forecast provider and cache.
- Weather risk rule engine.
- Venue weather metadata.
- Fixture weather refresh command or scheduler.
- Weather admin dashboard.
- Public weather risk badges.
- Postponed fixture weather inference.
- Weather risk tests and calibration fixtures.

## Out Of Scope For V1

- Paid weather APIs.
- Live weather calls during public search.
- Admin-editable threshold UI.
- Per-venue bespoke threshold editing.
- Guaranteed postponement predictions.
- Official postponement reason scraping.
- Push/email alerts for weather risk.
- Weather-based default sorting or filtering.
