# TICKET-013: Analytics And Monitoring

Status: open
Owner: QA/Release
Priority: medium
Depends on: TICKET-008

## Purpose

Understand whether users find the demo useful and catch failures before outreach follow-ups.

## Work

- Add privacy-conscious analytics for searches and correction submissions.
- Add server error logging.
- Track no-result searches.
- Document what is collected and why.

## Acceptance Criteria

- Basic usage can be measured.
- Failures are visible without checking server logs manually.
- Privacy copy is updated if needed.

## Verification

- Manual analytics event check.
- Error logging smoke test.
