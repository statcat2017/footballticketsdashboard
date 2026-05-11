# TICKET-006: Correction Review Workflow

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-003

## Purpose

Turn correction submissions into an inbox-driven data-quality workflow.

## Work

- Route public correction submissions into a dedicated corrections inbox created specifically for this purpose.
- Have an agent monitor that inbox, research incoming claims, and assess whether the submitted information can be validated.
- If the agent can validate the correction with sufficient confidence, update the relevant database records automatically.
- If the agent cannot validate the correction confidently, escalate it to a site admin review queue instead of applying it automatically.
- Maintain an audit trail of the original message, research outcome, and any automated or manual decision taken.
- Maintain a list of trusted contacts whose corrections can be incorporated into the database immediately, subject to minimal logging and provenance capture.

## Acceptance Criteria

- Public users cannot directly change live data.
- Validated corrections applied by the agent update displayed data.
- Unverified or disputed corrections are pushed to site admin for review instead of being auto-applied.
- Trusted contacts can submit corrections that are immediately written to the database and marked with trusted provenance.
- Rejected or superseded corrections remain stored for audit.

## Verification

- Correction intake tests.
- Trusted-contact handling tests.
- Manual review and escalation flow.
- Audit trail check for auto-applied and escalated corrections.
