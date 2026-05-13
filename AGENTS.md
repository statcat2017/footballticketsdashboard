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
2. **Always author commits and open PRs as `statcat2017-bots`** — the classic token in `.dev.vars` belongs to `statcat2017-bots`. A PR must NEVER be opened as `statcat2017`.
3. Configure Git and authenticate for this session:
   ```bash
   git config user.name "statcat2017-bots"
   git config user.email "statcat2017-bots@users.noreply.github.com"
   ```
4. **Every shell session that runs `gh` must export the token.** The parent shell's export does NOT propagate to child processes (including Task subagents). Always run before any `gh` command:
   ```bash
   export GH_TOKEN="$(grep ^GH_TOKEN= .dev.vars | cut -d= -f2)"
   ```
   To be safe, prefix `gh` commands with the inline env var:
   ```bash
   GH_TOKEN="$(grep ^GH_TOKEN= /absolute/path/to/.dev.vars | cut -d= -f2)" gh pr create ...
   ```
   > **Why this is needed:** `gh` may have multiple accounts logged in (e.g. via keyring). Without `GH_TOKEN` in the environment, `gh` falls back to the keyring account (`statcat2017`), which creates PRs as the wrong user. The classic token from `.dev.vars` is the only token that authenticates as `statcat2017-bots`.
5. Push the branch and open a PR against `main` referencing the issue number.
6. **Verify** the PR author before finishing:
   ```bash
   gh pr view --json author --jq .author.login
   # Must print: statcat2017-bots
   ```
7. Request review from `statcat2017` on the PR.

## Delegating to Subagents

When using the Task tool to delegate PR creation to a subagent, every subagent prompt MUST include the GH_TOKEN setup step. The parent shell's `export GH_TOKEN=...` does NOT propagate. Include this verbatim in each subagent's instructions:

```bash
git config user.name "statcat2017-bots"
git config user.email "statcat2017-bots@users.noreply.github.com"
export GH_TOKEN="$(grep ^GH_TOKEN= .dev.vars | cut -d= -f2)"
```

And verify the PR at the end:

```bash
gh pr view --json author --jq .author.login
```

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
