# TICKET-033: Pyramid Visualiser Page

Status: open
Owner: Frontend
Priority: medium
Depends on:

## Purpose

There is currently no visual representation of the English football pyramid in the app. The pyramid structure (14 divisions, 10 levels, 225 clubs, 20 promotion/relegation edges) exists as TypeScript constants in `lib/db/pyramid.ts` but is invisible to users and admins. A public SVG-based visualiser at `/pyramid` makes the pyramid tangible for pitch decks, partner demos, and user education.

## Work

### New files

- **`app/components/PyramidVisualiser.tsx`** — Client component (SVG-based):
  - Renders levels 1–10 as horizontal bands, stacked vertically with consistent spacing.
  - Each division is a labelled box showing its name and populated club count (e.g. "Premier League — 20 clubs").
  - **Promotion arrows** (green, upward-pointing) between divisions, using the `MEN_PYRAMID_EDGES` data.
  - **Relegation arrows** (red, downward-pointing) between divisions.
  - **Unpopulated divisions**: Step 7 divisions (NPL Premier, Isthmian Premier, SL Premier Central, SL Premier South) rendered as dimmed/dashed boxes with "(Not yet populated)" label.
  - **Level 8 gap**: shown as a dashed separator with a "No data" indicator.
  - Responsive — SVG scales with `viewBox` to fit the viewport width.
  - Tooltip or hover state showing division details (max size, number of clubs, level).

- **`app/pyramid/page.tsx`** — Server component:
  - Imports static pyramid constants: `MEN_PYRAMID_TEMPLATE`, `MEN_PYRAMID_DIVISIONS`, `MEN_PYRAMID_EDGES`, `MEN_PYRAMID_CLUBS`, `MEN_PYRAMID_SEASONS`.
  - Computes per-division club counts from `MEN_PYRAMID_MEMBERSHIPS`.
  - Renders `<PyramidVisualiser>` with the data.
  - Shows a stats header above the visualiser:
    - Total clubs: 225
    - Levels covered: 10 (with gaps at Level 8)
    - Divisions: 14
    - Season: 2025-26
  - Page metadata: `<title>`, `<meta description>` for SEO.
  - No database dependency — purely static data from the TypeScript constants.

### Modified files

- `app/admin/page.tsx` — Add a link to `/pyramid` in the admin dashboard under a new "Public pages" section (so admins can preview it).
- `app/layout.tsx` or navigation — Add a link to `/pyramid` if a nav exists; otherwise skip for now.

### Visual layout (SVG structure)

```
┌──────────────────────────────────────┐
│ Level 1                              │
│ ┌─────────────────────────────────┐  │
│ │ Premier League       20 clubs  │  │
│ └────────────▲────────────────────┘  │
│              │ ↑↓ (2 edges)          │
│ ┌────────────┴────────────────────┐  │
│ │ Championship         24 clubs  │  │
│ └────────────▲────────────────────┘  │
│              │ ↑↓                    │
│ ... (continues down to Level 10) ...│
│                                      │
│ ┌─────────────────────────────────┐  │
│ │ NWCFL Div 1 North  18 clubs    │  │
│ └─────────────────────────────────┘  │
└──────────────────────────────────────┘
```

Each arrow is a labelled SVG `<path>` with a `marker-end` arrowhead. Promotion arrows curve slightly to the left, relegation arrows to the right, so they don't overlap.

### Colour scheme

| Element | Colour |
|---|---|
| Division box fill | `#f5f7f7` |
| Division box border | `#dce3e2` |
| Promoted division (Level 1) | Gold accent |
| Promotion arrow | Green (`#147a4d`) |
| Relegation arrow | Red (`#c92a2a`) |
| Unpopulated (Step 7) box | Dashed border, light grey fill |
| Level 8 gap | Dashed separator, grey text |
| Text | `#17221f` / `#34413e` / `#6f7e7a` |

## Acceptance Criteria

- `/pyramid` renders the full pyramid diagram showing all 14 divisions across 10 levels.
- Each division box shows its name and club count.
- Green upward arrows connect promotion routes; red downward arrows connect relegation routes.
- Unpopulated Step 7 divisions appear with a dashed outline and "Not yet populated" text.
- Level 8 gap is clearly indicated.
- The diagram scales to fit desktop and tablet viewports.
- No database query is made — all data is from TypeScript constants.
- The visualiser is statically rendered (no client-side data fetching).

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual: visit `/pyramid` → verify all 10 levels render → verify arrow directions match `MEN_PYRAMID_EDGES` → verify club counts match `MEN_PYRAMID_CLUBS` grouped by division → resize browser to verify responsiveness.
