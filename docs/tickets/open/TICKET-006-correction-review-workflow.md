# TICKET-006: Correction Review Workflow

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-003

## Purpose

Turn correction submissions into a usable data-quality loop.

## Work

- Keep public correction submissions as pending.
- Add an internal review endpoint or admin page.
- Allow approve/reject actions.
- On approval, update the relevant club admission price and source URL.
- Keep an audit trail of the original submission.

## Acceptance Criteria

- Public users cannot directly change live prices.
- Approved corrections update displayed prices.
- Rejected corrections remain stored for audit.

## Verification

- Correction API tests.
- Manual approve/reject flow.
