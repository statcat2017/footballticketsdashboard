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

## Next Work

- Add Playwright after the dashboard stabilizes.
- Add adapter contract tests for each live source.
- Add failure tests for geocoder and source outages.
