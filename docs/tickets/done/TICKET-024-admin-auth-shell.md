# TICKET-024: Admin Auth Shell

Status: done
Owner: Backend
Priority: high
Depends on:

## Purpose

Create the private admin entry point and security baseline required before any data mutation tools are added.

## Work

- Add admin runtime configuration for `ADMIN_SECRET` and `ADMIN_SESSION_SECRET`.
- Add `/admin/login` and logout behavior.
- Set and validate an HTTP-only admin session cookie.
- Add a protected `/admin` dashboard shell.
- Protect `/admin` pages and `/api/admin/*` routes.
- Add CSRF token support for admin mutation APIs.
- Document local and production environment variable requirements.

## Acceptance Criteria

- Admin pages redirect unauthenticated users to `/admin/login`.
- Login fails with the wrong secret and succeeds with the configured secret.
- Login sets an HTTP-only cookie.
- Logout clears the admin cookie.
- Admin mutation routes reject missing or invalid CSRF tokens.
- No admin secret is exposed to client-side code.

## Verification

- Unit or route tests for login, logout, protected route access, and CSRF rejection.
- Manual local login/logout check.
- `npm run lint`
- `npm run test`
