# VPS Deployment

The app is deployed to a VPS as a Next.js standalone Node.js application.

## Build

GitHub Actions runs:

```bash
npm ci
npm run build
```

The deployment bundle is prepared from `.next/standalone`, `.next/static`, database migrations, and scripts.

## Runtime

The app runs under systemd as `nearmefc`.

Environment variables are loaded from:

```
/etc/nearmefc.env
```

Required variables:

```
SQLITE_DB_PATH=/srv/nearmefc/data/nearmefc.sqlite
ADMIN_SECRET=...
ADMIN_SESSION_SECRET=...
OPENROUTESERVICE_API_KEY=...
FOOTBALL_DATA_API_TOKEN=...
```

## Database

Production uses SQLite via `better-sqlite3`.

The application opens the configured database without creating, migrating, or seeding it. A missing database or pending migration fails startup with an instruction to run the relevant setup command. Production deploy applies migrations before restarting the service using:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/db-migrate-prod.ts
```

Use `npm run db:setup` only to deliberately initialize a new local or staging database with the demo/reference seed data. Re-running it preserves rows that already exist; operational reference-data edits must be made through the admin tools or import workflows.

## Health check

Deployment checks:

```
http://localhost:3000/api/health
```

## Naming

| Context | Name |
|---------|------|
| Repository | footballticketsdashboard |
| Product/service name | Near Me FC |
| Systemd service | nearmefc |
| SQLite database | nearmefc.sqlite |
