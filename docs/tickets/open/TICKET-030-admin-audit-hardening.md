# TICKET-030: Admin Audit Hardening

Status: review
Owner: Backend
Priority: medium
Depends on: TICKET-025
GitHub: https://github.com/statcat2017/footballticketsdashboard/issues/67

## Purpose

Tighten audit consistency before admin tools begin making substantive data changes.

## Work

- Decide whether login audit entries should explicitly set `actor` or rely on the helper default.
- Document that login/logout fail closed if audit writes fail, or change behavior deliberately.
- Add tests for audit failure behavior on login and logout.
- Consider adding request metadata that is safe to store, such as route/action context, without storing secrets.

## Acceptance Criteria

- Login and logout audit behavior is explicit and consistently tested.
- Audit failures have deliberate behavior documented in code or docs.
- No sensitive secret values are stored in audit rows.

## Verification

- Login/logout route tests for audit write failure behavior.
- Audit helper tests.
- `npm run lint`
- `npm run test`
