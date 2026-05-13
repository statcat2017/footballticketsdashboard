---
name: repo-docs
description: Inspect this repository and create or update agent-facing documentation, including architecture notes, setup instructions, workflows, file map, API routes, data model, testing commands, and known conventions.
compatibility: opencode
---

# Repo documentation skill

Use this skill when asked to make the repository easier for future coding agents to understand.

## Goal

Create or update concise documentation that helps future agents work safely and quickly in this repo.

## First inspect

Read these files/directories first if present:

- README.md
- package.json
- wrangler.toml
- schema.sql
- schema-migration.sql
- seed.sql
- functions/
- public/
- test/
- docs/
- .opencode/
- .agents/
- .claude/

## Produce or update

Create these files if they do not exist:

- `AGENTS.md` — top-level operating guide for agents
- `docs/architecture.md` — app structure and data flow
- `docs/api.md` — endpoints, methods, auth, request/response shape
- `docs/database.md` — tables, important columns, migrations
- `docs/workflows.md` — common dev/test/deploy workflows
- `docs/testing.md` — smoke tests and manual QA checklist
- `docs/known-risks.md` — edge cases, TODOs, design trade-offs

## Rules

Keep docs practical and short.

Prefer facts observed in the repo over guesses.

Mark uncertainty clearly.

Do not invent commands that are not present in the repo.

If a command is inferred, say so.

Include exact file paths when describing behaviour.

Do not change application code unless explicitly asked.

When documenting API routes, include:
- route path
- method
- auth requirement
- request body, if any
- response shape
- files involved

When documenting database behaviour, include:
- table names
- important columns
- relationships
- migration notes
- seed/reset behaviour

When documenting frontend behaviour, include:
- public page files
- admin page files
- important UI flows
- API calls made by each page

When documenting risks, include:
- known edge cases
- assumptions
- intentionally out-of-scope behaviour
- manual override points

## Final response

After generating or updating docs, summarise:
- files created
- files changed
- important uncertainties
- suggested next docs to maintain
