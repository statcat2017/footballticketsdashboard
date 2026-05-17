# TICKET-051: Weather Risk Postponement Warning Enhancement

Status: open
Owner: Backend / Frontend / Admin
Priority: medium
Depends on: TICKET-038, TICKET-040, TICKET-045, TICKET-046
Scheduled after: Fixture Operations Readiness Milestones 1-3

## Purpose

Add an enhancement that ingests free weather forecast data and flags fixtures where rain, frost/freezing, or storms may affect the match.

This should run after the fixture operations foundation is complete. It must not block the core real-fixture ingestion and admin readiness work.

## Work

- Use Open-Meteo as the first weather forecast provider.
- Cache normalized hourly weather by venue and forecast hour.
- Store derived fixture-level weather risk snapshots.
- Evaluate hazards for rain, frost/freezing, and storms.
- Use the 48 hours before kickoff for rain totals, with an extra bump for rain during the event window.
- Use previous overnight low and match-day daytime high before kickoff for frost risk.
- Use thunderstorm weather codes and sustained wind for storm risk.
- Use sustained wind thresholds of 30mph, 40mph, and 50mph for yellow, amber, and red.
- Use an event window of 2 hours before kickoff to 2 hours after kickoff.
- Add venue weather metadata for drainage sensitivity, surface type, and frost mitigation.
- Suppress normal frost risk where undersoil heating is confirmed.
- Reduce rain and frost risk for confirmed artificial surfaces, without reducing storm risk.
- Store risk levels `green`, `yellow`, `amber`, `red`, and `unavailable`.
- Store all contributing hazards and display the dominant hazard publicly.
- Add a structured `weatherRisk` object to fixture search results.
- Show public weather badges only for yellow, amber, and red risk.
- Use public copy that says `weather risk`, not `postponement risk`.
- For postponed fixtures, cautiously infer likely weather context from high risk, for example `Postponed; weather risk was high (rain)`.
- Add fixture admin weather columns and filters.
- Add an admin weather dashboard for high-risk fixtures, stale/missing forecasts, missing venue locations, provider failures, and rule version.
- Add a manual refresh command first, then scheduled refresh when deployment supports it.
- Keep public search resilient when the weather provider fails.

## Acceptance Criteria

- Weather forecast refresh never blocks public fixture search.
- Fixtures outside the forecast horizon are marked `unavailable`, not green.
- Public fixture cards show no weather badge for green or unavailable risk.
- Public fixture cards show compact yellow, amber, and red weather risk badges with dominant reason.
- Risk calculations are explainable from stored normalized forecast data and `rule_version`.
- Admins can see high-risk fixtures and weather refresh failures.
- Fixtures with missing venue coordinates show weather as unavailable in admin.
- Confirmed undersoil heating suppresses normal frost risk.
- Artificial surface reduces rain and frost risk but not storm risk.

## Verification

- Unit tests for Open-Meteo response normalization.
- Unit tests for rain thresholds and kickoff-window bump.
- Unit tests for frost thresholds, daytime thaw, undersoil heating, and artificial surface modifiers.
- Unit tests for storm weather codes and sustained wind thresholds.
- Unit tests for hazard combination and tie priority.
- Search response tests for structured `weatherRisk` output.
- UI tests or component tests for public weather badges where practical.
- Admin service tests for stale/missing/provider failure states.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Plan: [docs/weather-risk-enhancement-plan.md](../../weather-risk-enhancement-plan.md)
- Fixture operations plan: [docs/fixture-operations-readiness-plan.md](../../fixture-operations-readiness-plan.md)
