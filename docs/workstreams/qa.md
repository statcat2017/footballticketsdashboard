# QA Workstream

## Ownership

- Unit test coverage.
- API route and adapter contract tests.
- Browser-level user flows.
- Regression checklist before release.

## Required Checks

```bash
npm run lint
npm run test
npm run build
```

## Current Test Focus

- Postcode normalization.
- Distance and ranking order.
- Concession price application.
- Age-restricted filtering.
- Ingestion adapter contract helpers.

## Adapter Contract Scenarios

Every source adapter must have contract coverage for:

- successful public opportunity leads with source provenance;
- successful empty source, with no placeholder leads;
- blocked, disallowed, login-required, or protected-flow source, with diagnostics;
- parser failure, with diagnostics and no placeholder leads;
- adapter registry behavior when relevant.

## Next Work

- Add Playwright coverage for opportunity search after the dashboard pivot.
- Add source-specific adapter contract tests for each live source.
- Add failure tests for geocoder and source outages.
