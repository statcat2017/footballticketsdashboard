# TICKET-052: Admin Publish UX — success/error banners, existing-club mapping, button gating

Status: open
Owner: Admin / Backend
Priority: high
Depends on: none

## Purpose

Make the admin publish flow visible and functional. Currently:

- The page ignores `?error=` and `?success=` query params, so clicks appear to do nothing.
- Club publish rejects clubs that already exist in `public_clubs` by name, even when a `club_mappings` row is what's actually missing.
- Club publish buttons are shown for clubs in un-mapped divisions, causing silent "Division has no competition mapping" redirects.

## Work

### 1. Add success/error banner to `/admin/publish`

Add `searchParams` handling to `app/admin/publish/page.tsx` to render a visible banner when redirected with `?success=` or `?error=`.

### 2. Map existing public clubs instead of rejecting

Change `app/api/admin/publish/club/route.ts`:

- When `SELECT id FROM clubs WHERE name = ?` finds a match, INSERT the `club_mappings` row instead of erroring.
- Validate that the existing club has a `competition_code` and `venue_id` before mapping. If missing, redirect with an appropriate error.
- Wrap the insert + mapping + audit in a transaction.

### 3. Gate publish button by division mapping

In `app/admin/publish/page.tsx`, show `Publish` or "Create venue first" only when the division already has a mapping. If the division has no `competition_code` mapping, show a disabled state or "Publish competition first" label.

### 4. Tests

Add tests covering:

- Publishing a new club (insert + mapping + audit)
- Mapping an existing public club with matching name (insert club_mappings, no duplicate clubs)
- Blocked publish when division has no competition mapping
- Blocked publish when club has no venue
- Success/error banners render in `/admin/publish`
