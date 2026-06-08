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

## Absolute Rules

- Never merge any pull request under any circumstances. Only `statcat2017` may merge.
- Never use `--admin` or any admin override flag on `gh pr merge` or any other command to bypass branch protections or review requirements.
- If the user asks you to deploy, push the branch and notify them that a PR is ready for review. Do not merge or deploy without explicit approval.

## Issue Resolution

When resolving a GitHub issue:
1. Create a new branch off `main` specific to the issue, using the format `fix/issue-{number}-{short-description}` or `feat/issue-{number}-{short-description}`.
2. Always author commits and open PRs as `statcat2017-bots` so the account owner can review as `statcat2017`. Configure Git and authenticate for this session with:
   ```bash
   git config user.name "statcat2017-bots"
   git config user.email "statcat2017-bots@users.noreply.github.com"
   export GH_TOKEN="$(grep ^GH_TOKEN= .dev.vars | cut -d= -f2)"
   ```
3. Push the branch and open a PR against `main` referencing the issue number.
4. Request review from `statcat2017` on the PR.

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

- Production secrets live in `/etc/nearmefc.env` on the VPS and are loaded by the systemd/deploy process.
- Local development secrets live in `.dev.vars`.
- Never commit real secrets or generated environment files.

## Pre-commit Hook

A pre-commit hook at `.husky/pre-commit` scans staged files for secret-like patterns (API keys, tokens). If triggered, review the flagged files and use `git commit --no-verify` only if you are certain the matches are false positives.

## Secrets Rotation

- Rotate `.dev.vars` secrets quarterly or immediately if a leak is suspected.
- Run `npm run lint && npm run test && npm run build` after rotating any key that affects runtime behavior.
- Never commit `.dev.vars` or any file containing real secret values.
