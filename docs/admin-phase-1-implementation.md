# Admin Phase 1 Implementation Plan

Phase 1 establishes the private admin foundation. It should not introduce club editing, map picking, league swapping, publishing, or correction review.

## Scope

- Admin login/logout and protected admin shell.
- Shared-secret auth using server-side environment variables.
- HTTP-only signed admin session cookie.
- CSRF protection for admin mutation routes.
- Reusable admin route/page guard helpers.
- Admin audit log table and write helper.
- Database write-batch primitive for local SQLite and D1-backed app code.
- Minimum phase 1 schema: admin audit logging only.
- Tests and docs for the above.

## Non-Goals

- Club or venue editing UI.
- Google Maps integration.
- League swapper UI or movement application behavior.
- Public publish/sync implementation.
- Data export UI.
- Correction review queue.

## Proposed File Map

- `app/admin/login/page.tsx`: login form.
- `app/admin/page.tsx`: minimal protected dashboard.
- `app/api/admin/login/route.ts`: validate shared secret and set session cookie.
- `app/api/admin/logout/route.ts`: clear session cookie.
- `app/api/admin/csrf/route.ts`: issue or expose CSRF token for authenticated admin pages if needed by client mutations.
- `lib/admin/auth.ts`: session signing, cookie parsing, auth guard, login/logout helpers.
- `lib/admin/csrf.ts`: CSRF token creation and validation.
- `lib/admin/audit.ts`: audit write helper and types.
- `lib/admin/config.ts`: admin env accessors.
- `lib/db/adapter.ts`: write-batch API extension.
- `lib/db/schema.ts`: admin audit schema addition.
- `lib/db/migrations/*`: D1/SQLite migration files matching schema changes.
- `tests/adminAuth.test.ts`: auth/session/CSRF behavior.
- `tests/adminAudit.test.ts`: audit helper behavior.
- `tests/dbAdapter.test.ts`: adapter write-batch behavior.

## Auth Design

Use two server-side secrets:

- `ADMIN_SECRET`: password/token entered at login.
- `ADMIN_SESSION_SECRET`: signing key for admin session and CSRF tokens.

Session cookie shape:

- Name: `nearmefc_admin`.
- Contents: signed payload with static actor and issued/expiry timestamps.
- Cookie flags: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` in production.
- Cookie path is `/` so both `/admin` pages and `/api/admin/*` routes receive it.
- Actor: static value, e.g. `admin`.

Recommended expiry:

- 8 hours for the first implementation.
- Refresh only on a new login, not every request.

Auth behavior:

- `/admin/login` is public.
- `/admin` pages require a valid session cookie.
- `/api/admin/*` routes require a valid session cookie, except login/logout routes as appropriate.
- Missing or invalid auth returns redirect for pages and `401` JSON for APIs.

## CSRF Design

Use a double-submit style token or signed token tied to the admin session.

Recommended first implementation:

- Generate a signed CSRF token after login or on an authenticated `/api/admin/csrf` request.
- Admin client requests send the token in `x-admin-csrf-token` for `POST`, `PATCH`, `PUT`, and `DELETE` admin APIs.
- Server-rendered HTML forms may submit the token as a `csrf` form field when handled by routes that explicitly support form posts, such as logout.
- Mutation routes reject missing/invalid tokens with `403`.
- `GET` admin APIs do not require CSRF.

This is enough for phase 1. Later client forms can share one small fetch helper that attaches the token.

## Audit Design

Add `admin_audit_log` with columns equivalent to:

- `id INTEGER PRIMARY KEY`
- `actor TEXT NOT NULL`
- `action TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT`
- `before_json TEXT`
- `after_json TEXT`
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`

Initial helper contract:

```ts
type AdminAuditAction = "create" | "update" | "delete" | "login" | "logout" | "unlock" | "publish";

interface AdminAuditInput {
  actor?: string;
  action: AdminAuditAction;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}
```

The helper should JSON-stringify `before` and `after`, default actor to `admin`, and reject non-serializable payloads clearly.

## Write-Batch Design

Extend `AppDatabase` with a write-only atomic batch primitive:

```ts
interface SqlWrite {
  sql: string;
  params?: QueryParam[];
}

writeBatch(statements: SqlWrite[]): Promise<Array<{ lastInsertRowid?: number; changes: number }>>;
```

SQLite behavior:

- Wrap precomputed statements in `BEGIN`, `COMMIT`, and `ROLLBACK`.
- Use the same underlying connection.
- Roll back if a statement throws.

D1 behavior:

- Use `D1Database.batch()` with prepared statements.
- Cloudflare documents D1 batches as transactional: if one statement fails, the sequence is aborted or rolled back.
- Do not expose a callback-style transaction API because D1 does not naturally support arbitrary read/write branching inside one transaction.

Phase 1 should resolve this before later admin writes depend on it.

## Foundational Schema

Phase 1 intentionally keeps schema changes minimal:

- `admin_audit_log` table.

The larger pyramid, movement, season, and import-protection schema changes are deferred to later phase-specific PRs.

## Implementation Sequence

1. Add admin config helpers and tests for missing/present env behavior.
2. Add signed session cookie helpers.
3. Add login/logout API routes and tests.
4. Add protected admin dashboard and route/page guard behavior.
5. Add CSRF helpers and route tests for mutation rejection.
6. Add `admin_audit_log` schema and audit helper tests.
7. Extend database adapter with write-batch support and rollback tests.
8. Add only the minimum admin audit schema.
9. Update schema documentation and deployment notes.
10. Run `npm run lint`, `npm run test`, and `npm run build`.

## Test Plan

- Auth helpers reject missing, malformed, expired, and badly signed cookies.
- Login route rejects incorrect secret.
- Login route sets an HTTP-only cookie on correct secret.
- Logout route clears the cookie.
- Protected admin APIs return `401` without a valid session.
- Mutation APIs return `403` without a valid CSRF token.
- Audit helper inserts expected row values.
- SQLite write batch commits on success and rolls back on thrown error.
- D1 adapter test verifies the intended batch mechanism.
- Existing database setup remains idempotent.

## Handoff Criteria

- Phase 1 admin dashboard exists but contains only foundation/status content.
- No data-editing admin actions are exposed yet.
- Security-sensitive values stay server-side.
- Tests cover auth, CSRF, audit, and write-batch primitives.
- Documentation names required environment variables and the next phase dependency points.
