# TICKET-017: Correction Inbox Intake

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-006

## Purpose

Create the dedicated intake path for correction emails so submissions become structured workflow items instead of ad hoc messages.

## Work

- Create or integrate a dedicated corrections inbox for incoming club, venue, fixture, and pricing updates.
- Ingest inbox messages into the application as structured correction records.
- Capture sender identity, subject, body, attachments or links, and received timestamps.
- Record provenance so later agent or admin decisions can always reference the original message.
- Define failure handling for malformed or duplicate inbound messages.

## Acceptance Criteria

- Correction emails sent to the dedicated inbox are persisted as structured intake records.
- Original message content and provenance are stored for audit.
- Duplicate or malformed intake does not silently disappear.

## Verification

- Inbox ingestion tests.
- Duplicate-handling tests.
- Manual check that a test email becomes a stored correction record.
