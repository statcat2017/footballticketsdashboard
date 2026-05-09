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
- The UI expects `RankedTicketResult[]`.

## Next Work

- Add richer filtering and sorting controls once live source metadata exists.
- Add Playwright coverage for desktop and mobile.
- Improve result density for repeated use while keeping mobile readable.
