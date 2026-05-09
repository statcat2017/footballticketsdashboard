# Ticket System

This folder is the repo-native implementation control system. Use it to keep work piecemeal, reviewable, and safe for multi-agent development.

## Workflow

1. Create a ticket in `docs/tickets/open`.
2. Keep the ticket small enough for one focused implementation pass.
3. Assign an owner role: Orchestrator, DBA, Backend ingestion, Club Swarm Backend ingestion, Frontend, Ranking/location, or QA.
4. Implement only what the ticket says.
5. Add tests and update docs listed in the ticket.
6. Move the ticket to `docs/tickets/done` when merged/accepted.

## Status Values

- `open`: ready to start.
- `in-progress`: actively being implemented.
- `blocked`: waiting on a decision, model change, source clarification, or dependency.
- `review`: implementation complete, needs review.
- `done`: accepted and moved to `docs/tickets/done`.

## Rules

- One ticket per PR/change set unless the Orchestrator approves grouping.
- Do not implement club adapters before the shared data model and adapter contract exist.
- Do not emit fake prices, fake sale states, or invented venue data to satisfy the UI.
- Do not crawl protected ticketing flows.
- Any source-specific parser must include fixtures and contract tests.
