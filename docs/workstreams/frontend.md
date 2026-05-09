# Frontend Workstream

## Ownership

- Dashboard layout and interaction.
- Postcode and age form.
- Results display and ranking explanations.
- Empty, loading, and error states.
- Responsive and accessible UI.

## Current Surface

- Main UI lives in `app/components/SearchDashboard.tsx`.
- Search is performed through `POST /api/search`.
- The UI expects `RankedTicketOpportunityResult[]`, a display DTO derived from `TicketOpportunityLead`.
- Unknown price, kickoff, and venue values are shown explicitly rather than invented.
- Result cards use sale-state labels such as pay-on-gate, ticket lead, not-on-sale, sold-out, and unknown.
- The current API path uses the Dulwich Hamlet official adapter and may show an empty state when the live official fixture pages report no fixtures.

## Next Work

- Add richer filtering and sorting controls once live source metadata exists.
- Broaden Playwright coverage for desktop and mobile.
- Improve result density for repeated use while keeping mobile readable.
