# Project Guide

This repo is a fresh foundation for a UK football fixture finder.

## Product Direction

Build a simple web app that shows nearby upcoming football fixtures, where they are, best-effort admission pricing, and cached travel estimates. The first demo uses Premier League and Championship data as a proof of capability for a future Non League Day / Football Web Pages partnership.

## Current MVP Rules

- Use a SQLite database as the product source of truth.
- Use historical/demo fixtures when live fixtures are unavailable, clearly labelled.
- Store admission prices as best-effort club-level data with source URLs and a disclaimer.
- Cache travel by postcode district and venue; never block search if travel APIs are unavailable.
- Store correction submissions as pending review; never auto-apply them.

## Workflow

- Before making any code changes, create a new branch off `main` with a descriptive name (e.g., `feat/dashboard-polish`, `fix/error-handling`).
- Never commit or push directly to `main`. Always open a PR for review.
- If a branch already exists for the task, check it out and work there.

## Issue Resolution

When resolving a GitHub issue:
1. Create a new branch off `main` specific to the issue, using the format `fix/issue-{number}-{short-description}` or `feat/issue-{number}-{short-description}`.
2. Always author commits as `statcat2017-bots` so the account owner can review as `statcat2017`. Configure Git for this session with:
   ```bash
   git config user.name "statcat2017-bots"
   git config user.email "statcat2017-bots@users.noreply.github.com"
   ```
3. Authenticate `gh` CLI with the bots account token:
   ```bash
   export GH_TOKEN="<statcat2017-bots-personal-access-token>"
   ```
   This ensures PRs are created as `statcat2017-bots` and can be reviewed by `statcat2017`.
4. Push the branch and open a PR against `main` referencing the issue number.
5. Request review from `statcat2017` on the PR.

## Deferred

- Non-league fixture ingestion until a data partnership/source is agreed.
- Live inventory, seat maps, baskets, checkout, queue, CAPTCHA, or account flows.
- Fixture-specific ticket purchase automation.

## Validation

Run before handoff:

```bash
npm run lint
npm run test
npm run build
```

## Secrets

- API keys (OpenRouteService, TravelTime, Football Data) live in Cloudflare Secrets for production and in `.dev.vars` for local development. Never commit API keys to `wrangler.jsonc`.
