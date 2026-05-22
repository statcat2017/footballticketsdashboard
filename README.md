# Near Me FC

A UK football fixture finder that shows nearby upcoming matches, venue locations, admission pricing, and cached travel estimates.

**Live demo:** [fixtures.statcat.co.uk](https://fixtures.statcat.co.uk)

## What It Does

- Search for fixtures near your postcode within a configurable radius
- View club-level admission prices (adult, concession) with source attribution
- See cached travel times (driving via OpenRouteService, public transport via TfL for London)
- Submit data corrections for review (never auto-applied)
- Explore the English football pyramid from Premier League down to Step 6

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Runtime:** Cloudflare Workers (via OpenNext adapter)
- **Database:** Cloudflare D1 (production) / SQLite (local)
- **Testing:** Vitest + Playwright
- **Validation:** Zod

## Quick Start

```bash
npm install
npm run db:setup    # Creates local SQLite database and seeds demo data
npm run dev         # Starts dev server
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:setup` | Create/reset local SQLite with seed data |
| `npm run db:migrate` | Apply pending migrations |
| `npm run import:clubs` | Import club seed data from CSV |
| `npm run travel:fill` | Populate travel cache |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run typecheck` | TypeScript type checking |

## Project Structure

```
app/                    # Next.js app routes (pages + API)
lib/
  db/                   # Database layer
    schema.ts           # Single source of truth for all tables
    migrations/         # Numbered SQL migrations (001-027)
  admin/                # Admin service modules
  import/               # Fixture import pipeline (adapters, validation)
  search/               # Public search service
  travel/               # Travel cache and providers
docs/
  schema.md             # Human-readable schema documentation
  production-roadmap.md # Six-phase roadmap to launch
  project-plan.md       # MVP scope and deferred items
  tickets/              # File-based ticket tracking system
  sprints/              # Sprint plans and retrospectives
data/                   # CSV seed files (clubs, championship clubs)
```

## Documentation

- [Schema](docs/schema.md) — All 22 tables, rules, and retired tables
- [Production Roadmap](docs/production-roadmap.md) — Six phases from demo to launch
- [Project Plan](docs/project-plan.md) — MVP scope, admin data maintenance, deferred items
- [Cloudflare Deployment](docs/cloudflare-deployment.md) — Production deploy guide
- [API Reference](docs/search-api.md) — POST /api/search contract
- [Travel Cache](docs/travel-cache.md) — Caching strategy and manual fill commands
- [Admin Interface Plan](docs/admin-interface-plan.md) — Four-phase admin build plan

## Data Sources

- Premier League and Championship club/ground data (2025-26 season)
- football-data.org API for live fixture imports
- OpenRouteService for driving time estimates
- TfL API for London public transport times

## Contributing

This project uses a file-based ticket tracking system under `docs/tickets/`. Before making changes:

1. Check existing tickets in `docs/tickets/open/` and `docs/tickets/done/`
2. Create a new branch off `main` with a descriptive name
3. Never commit or push directly to `main` — always open a PR for review

See [AGENTS.md](AGENTS.md) for detailed workflow rules and conventions.

## License

Private project — all rights reserved.
