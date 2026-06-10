import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import { adminRedirect } from "@/lib/admin/redirect";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const venueId = parseInt(id, 10);
  if (isNaN(venueId) || venueId <= 0) {
    return NextResponse.json({ error: "Invalid venue ID." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const confirm = form.get("confirm");
  if (confirm !== "1") {
    return adminRedirect(request, `/admin/venues/${venueId}?error=Please confirm the delete action.`);
  }

  const db = await getDatabase();

  try {
    const venue = await db.get<{ id: number; name: string }>(
      `SELECT id, name FROM venues WHERE id = ?`, [venueId]
    );
    if (!venue) {
      return adminRedirect(request, `/admin/venues?error=Venue not found.`);
    }

    // Check all FK references before deletion
    const publicClubs = await db.all<{ id: number; name: string }>(
      `SELECT id, name FROM clubs WHERE venue_id = ? LIMIT 1`, [venueId]
    );
    if (publicClubs.length > 0) {
      return adminRedirect(request, `/admin/venues/${venueId}?error=Cannot delete: "${venue.name}" is the primary ground for public club "${publicClubs[0].name}". Reassign the club's venue first.`);
    }

    const pyramidAssignments = await db.all<{ id: number }>(
      `SELECT id FROM club_venue_assignments WHERE venue_id = ? AND is_primary = 1 AND effective_to IS NULL LIMIT 1`,
      [venueId]
    );
    if (pyramidAssignments.length > 0) {
      return adminRedirect(request, `/admin/venues/${venueId}?error=Cannot delete: venue is assigned as primary ground for a pyramid club. Remove the assignment first.`);
    }

    const fixtures = await db.all<{ id: number }>(
      `SELECT id FROM fixtures WHERE venue_id = ? LIMIT 1`, [venueId]
    );
    if (fixtures.length > 0) {
      return adminRedirect(request, `/admin/venues/${venueId}?error=Cannot delete: venue is used by ${fixtures.length} fixture(s). Reassign fixtures first.`);
    }

    // Explicitly clean up related tables before deleting the venue.
    // The schema may not have ON DELETE CASCADE for all FKs, so we
    // handle travel_cache and import_batch_rows here.
    await db.writeBatch([
      {
        sql: `DELETE FROM travel_cache WHERE venue_id = ?`,
        params: [venueId],
      },
      {
        sql: `UPDATE import_batch_rows SET venue_resolved_id = NULL WHERE venue_resolved_id = ?`,
        params: [venueId],
      },
      {
        sql: `DELETE FROM venues WHERE id = ?`,
        params: [venueId],
      },
      buildAdminAuditLogWrite({
        action: "delete",
        entityType: "venue",
        entityId: venueId,
        actor: session.actor ?? "admin",
        before: { name: venue.name },
      }),
    ]);

    return adminRedirect(request, `/admin/venues?deleted=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return adminRedirect(request, `/admin/venues/${venueId}?error=${encodeURIComponent(message)}`);
  }
}
