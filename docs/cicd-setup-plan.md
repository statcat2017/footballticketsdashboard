# CI/CD Setup Plan

**Date:** 2026-05-21
**Status:** Proposed
**Scope:** PR checks workflow + health endpoint + deploy hardening

## Problem

Currently:
- No automated PR checks (must run `npm test && npm run build` locally before every PR)
- Deploy workflow restarts systemd but has no health check — it says "success" even if the app crashes on startup
- No separation between PR validation and production deployment
- Manual SSH restarts are needed when deploys fail

## Goal

```
PR opened → automated checks (typecheck, test, build)
merge to main → automated deploy + migration + restart + health check
```

## Changes

### 1. Health endpoint

**File:** `app/api/health/route.ts` (new)

```ts
import { NextResponse } from "next/server";
import Database from "better-sqlite3";

export async function GET() {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) {
    return NextResponse.json({ ok: false, error: "SQLITE_DB_PATH not set" }, { status: 503 });
  }

  try {
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");
    db.prepare("SELECT 1").get();
    db.close();

    return NextResponse.json({
      ok: true,
      db: true,
      version: process.env.npm_package_version ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: false, error: String(err) },
      { status: 503 }
    );
  }
}
```

**Why:** The deploy workflow needs a way to verify the app actually came back. Without this, GitHub Actions says "deploy successful" when all it knows is "rsync finished and systemd accepted a restart request."

**Tradeoff:** Opens a new endpoint. It's read-only and uses a separate Database instance (not the singleton), so it doesn't interfere with the app's DB connection. The `readonly: true` flag prevents any writes.

### 2. Typecheck script

**File:** `package.json` (modify)

Add to scripts:
```json
"typecheck": "tsc --noEmit"
```

**Why:** `npx tsc --noEmit` works but having it as a script makes it explicit and consistent. Used by both PR checks and local dev.

### 3. PR checks workflow

**File:** `.github/workflows/pr-checks.yml` (new)

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]
  push:
    branches-ignore: [main]

jobs:
  checks:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Tests
        run: npm run test

      - name: Build
        run: npm run build
```

**Why:** Every PR gets automatic validation. No more "I forgot to run tests locally." The workflow runs on PRs targeting main AND on pushes to non-main branches (so feature branches get checked too).

**Cost:** ~2-3 minutes per run. GitHub free tier: 2,000 minutes/month for private repos. 20 PRs/month = ~60 minutes.

### 4. Deploy workflow hardening

**File:** `.github/workflows/deploy.yml` (modify)

Add after the "Restart app" step:

```yaml
- name: Health check
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.DEPLOY_HOST }}
    username: appuser
    key: ${{ secrets.DEPLOY_KEY }}
    script: |
      sleep 3
      curl -fsS --max-time 10 http://localhost:3000/api/health
```

**Why:** The deploy now fails if the app doesn't come back healthy within 13 seconds (3s sleep + 10s timeout). This catches:
- Migration failures
- Seed crashes (like the UNIQUE constraint bug we just fixed)
- Missing environment variables
- Native module architecture mismatches (the better-sqlite3 macOS→Linux issue)

**Tradeoff:** Uses `localhost:3000` instead of the public URL — avoids Caddy/proxy issues and DNS propagation delays. The app binds to `0.0.0.0:3000` so localhost works.

### 5. Systemd service — WorkingDirectory

**File:** `/etc/systemd/system/nearmefc.service` (on VPS, already correct)

Current state:
```ini
WorkingDirectory=/srv/nearmefc
ExecStart=/usr/bin/node server.js
```

This is correct. No change needed. The deploy target (`DEPLOY_PATH`) is `/srv/nearmefc`.

**Future consideration:** Atomic deploys with releases directory + symlink:
```
/srv/nearmefc/releases/2026-05-21-abc123/
/srv/nearmefc/current -> /srv/nearmefc/releases/2026-05-21-abc123
```
Systemd would point at `/srv/nearmefc/current`. Rollback becomes `ln -sfn` + restart. Defer until iteration velocity justifies the complexity.

### 6. Sacred rule: never touch the DB during deploy

**File:** `.github/workflows/deploy.yml` (already correct)

The `EXCLUDE` pattern in the rsync step:
```yaml
EXCLUDE: "data/*.sqlite, data/*.sqlite-shm, data/*.sqlite-wal"
```

The production DB lives at `/var/lib/nearmefc/nearmefc.sqlite` — completely outside the deploy directory. The `--delete` flag in rsync will never touch it.

**Risk:** If someone changes `DEPLOY_PATH` or moves the DB file, this breaks. The rule is: code goes in `/srv/nearmefc`, DB stays in `/var/lib/nearmefc`. Never mix them.

## Execution order

1. Create `app/api/health/route.ts`
2. Add `typecheck` script to `package.json`
3. Create `.github/workflows/pr-checks.yml`
4. Update `.github/workflows/deploy.yml` with health check step
5. Test locally: `npm run typecheck && npm run test && npm run build`
6. Push to branch, verify PR checks run
7. Merge, verify deploy + health check passes

## What changes for the user

| Action | Before | After |
|--------|--------|-------|
| Open PR | Run `npm test && npm run build` locally first | Push → GitHub runs checks automatically |
| Review PR | Trust local test results | See green checkmarks on the PR |
| Merge to main | SSH into VPS → restart → curl to verify | Auto-deploy, auto-migrate, auto-restart, auto-health-check |
| Deploy fails | Discover manually, investigate | GitHub Actions fails the job, shows the error |

## What doesn't change

- PRs still don't deploy to production (only merges to main do)
- The deploy workflow still runs on push to main (already the case)
- The VPS directory structure stays the same
- SQLite DB location stays the same
- No new infrastructure, no new costs

## Rollback plan

If the health check causes deploy failures:
1. Remove the health check step from `deploy.yml`
2. The rest of the deploy (rsync + restart) still works

If the health endpoint causes issues:
1. Delete `app/api/health/route.ts`
2. Revert the health check step

Both are single-file changes.
