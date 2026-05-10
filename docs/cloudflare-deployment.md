# Cloudflare Deployment

This app should be deployed to Cloudflare Workers with the OpenNext adapter, not as a static Pages site.

## Recommended shape

- Keep `statcat.co.uk` on Pages for the Astro homepage.
- Deploy this app as a separate Worker-backed Next.js application.
- Attach it to `fixtures.statcat.co.uk`.
- Use Cloudflare D1 instead of the local `better-sqlite3` file for production.

## One-time setup

1. Install dependencies:
   `npm install`
2. Create a D1 database:
   `npx wrangler d1 create nearme-fc`
3. Copy the returned database ID into [wrangler.jsonc](/Users/ben/footballticketsdashboard/wrangler.jsonc:1).
4. Generate Cloudflare types:
   `npm run cf-typegen`
5. Apply schema:
   `npx wrangler d1 execute nearme-fc --file=data/d1/schema.sql`
6. Seed demo data:
   `npx wrangler d1 execute nearme-fc --file=data/d1/seed.sql`
7. Optional: import club metadata into D1 from CSV:
   `npm run import:clubs:d1 -- nearme-fc data/clubs.csv`
8. Optional: import current fixtures into D1 from football-data:
   `FOOTBALL_DATA_API_TOKEN=... npm run import:football-data:d1 -- nearme-fc`

## Local workflow

- `npm run dev` uses the normal Next.js development server.
- `npm run preview` builds and runs the app in the Cloudflare Worker runtime.
- `npm run deploy` builds and deploys to Cloudflare Workers.
- `npm run import:clubs` and `npm run import:football-data` still target local SQLite.
- `npm run import:clubs:d1` and `npm run import:football-data:d1` target the remote D1 database through Wrangler.

## Cloudflare dashboard

In `Workers & Pages`:

1. Create or connect the Worker for this repo.
2. Set the production custom domain to `fixtures.statcat.co.uk`.
3. Add any production environment variables or secrets required for imports.
4. Confirm the D1 binding is present as `DB`.

## Current project values

- Cloudflare account ID: `364de1251111504848513a0d6340af3a`
- D1 database name: `football`
- D1 database ID: `c7643fe6-f9f4-4752-a01e-b510fca25fb6`
- Custom domain route: `fixtures.statcat.co.uk`

## Notes

- Local SQLite is still used for tests and local seed/import scripts.
- Production requests use the D1 binding exposed to the Worker.
- If you want this app under `/fixtures` instead of a subdomain, add a Next.js base path and route it explicitly from Cloudflare.
