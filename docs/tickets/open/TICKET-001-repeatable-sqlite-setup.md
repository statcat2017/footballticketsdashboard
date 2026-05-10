# TICKET-001: Repeatable SQLite Setup

Status: review
Owner: Backend
Priority: high
Depends on:

## Purpose

Turn the current auto-initialized SQLite demo database into a deliberate setup step that can be run locally, in CI, and on a host.

## Work

- Add a command such as `npm run db:setup`.
- Create the SQLite file, apply schema, and seed demo data idempotently.
- Keep `data/nearmefc.sqlite` ignored by git.
- Document how to reset and recreate the database.

## Acceptance Criteria

- A fresh clone can create a working database with one command.
- Running setup twice does not duplicate seed rows.
- Tests can still use in-memory SQLite.

## Verification

- `npm run db:setup`
- `npm run test`
- Manual search returns demo fixtures.

## Backend Update

- Added `npm run db:setup`.
- Setup creates the parent `data/` directory, applies schema upgrades, and upserts seed data.
- `data/nearmefc.sqlite` remains covered by the existing `*.sqlite` gitignore rule.
- Reset: delete `data/nearmefc.sqlite`, then rerun `npm run db:setup`.
