# TICKET-020: Correction Admin Review Queue

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-018, TICKET-019

## Purpose

Give site admins a clear place to review corrections that the agent could not validate confidently or that require human judgment.

## Work

- Add an internal admin endpoint or page for escalated correction records.
- Show the original submission, provenance, agent findings, and current recommended action.
- Allow admin approve, reject, and defer actions.
- Record who made the decision and when.
- Keep review history visible for audit.

## Acceptance Criteria

- Escalated corrections appear in an admin review queue.
- Admins can approve or reject with a recorded decision trail.
- Rejected or deferred items remain visible for audit.

## Verification

- Manual admin review flow.
- Decision recording tests.
- Audit history check for reviewed items.
