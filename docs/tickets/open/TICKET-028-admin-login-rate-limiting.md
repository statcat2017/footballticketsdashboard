# TICKET-028: Admin Login Rate Limiting

Status: review
Owner: Backend
Priority: high
Depends on: TICKET-024
GitHub: https://github.com/statcat2017/footballticketsdashboard/issues/65

## Purpose

Reduce brute-force risk before admin data-editing tools are exposed.

## Work

- Add rate limiting to `POST /api/admin/login`.
- Key attempts by the best available client identifier for local and Cloudflare deployments.
- Use a short rolling window, such as 15 minutes.
- Return a clear `429` response when the limit is exceeded.
- Keep successful login behavior unchanged.
- Document any required storage or deployment configuration.

## Acceptance Criteria

- Repeated failed login attempts are blocked after the configured threshold.
- Successful login is possible after the window expires.
- Rate limiting does not expose whether the admin secret was close or correct.
- Tests cover allowed, blocked, and reset behavior.

## Verification

- Login route tests for rate limiting.
- Manual local check.
- `npm run lint`
- `npm run test`
