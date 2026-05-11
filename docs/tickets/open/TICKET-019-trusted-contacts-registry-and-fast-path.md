# TICKET-019: Trusted Contacts Registry And Fast Path

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-017

## Purpose

Allow specific trusted contacts to update data immediately while still preserving provenance and auditability.

## Work

- Maintain a registry of trusted contacts and the identifiers used to recognize them.
- Define which kinds of corrections from trusted contacts can be written through immediately.
- Mark trusted-source corrections with explicit provenance in the database.
- Ensure trusted updates still create an audit record and can be reviewed later if needed.
- Define how trusted status is added, changed, or revoked.

## Acceptance Criteria

- Trusted contacts are stored in a manageable registry.
- Recognized trusted corrections are applied immediately with trusted provenance.
- Every trusted update remains auditable and reversible.

## Verification

- Trusted-contact matching tests.
- Immediate-apply flow tests.
- Audit trail check for trusted updates.
