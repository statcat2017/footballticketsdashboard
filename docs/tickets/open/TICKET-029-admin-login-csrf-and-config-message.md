# TICKET-029: Admin Login CSRF And Public Config Message

Status: open
Owner: Backend
Priority: medium
Depends on: TICKET-024
GitHub: https://github.com/statcat2017/footballticketsdashboard/issues/66

## Purpose

Make the public admin login surface more deliberate before expanding admin functionality.

## Work

- Decide whether `/admin/login` should require CSRF protection.
- If login CSRF is adopted, add token issuance and validation for the login form.
- Replace the unauthenticated "Admin access is not configured" message with a less implementation-specific message.
- Ensure missing admin configuration remains obvious in logs or authenticated operational checks.

## Acceptance Criteria

- The login CSRF decision is documented and implemented if required.
- The public login page does not name specific secret environment variables.
- Tests cover the configured and unconfigured login page states.

## Verification

- Admin login page tests or route checks.
- Manual local check with and without admin env vars.
- `npm run lint`
- `npm run test`
