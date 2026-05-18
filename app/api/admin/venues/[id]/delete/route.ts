import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";

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
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=Please confirm the delete action.`, request.url),
      { status: 303 },
    );
  }

  const db = await getDatabase();

  try {
    const venue = await db.get<{ id: number; name: string }>(
      `SELECT id, name FROM venues WHERE id = ?`, [venueId]
    );
    if (!venue) {
      return NextResponse.redirect(
        new URL(`/admin/venues?error=Venue not found.`, request.url),
        { status: 303 },
      );
    }

    const clubsUsing = await db.all<{ id: number }>(
      `SELECT id FROM clubs WHERE venue_id = ? LIMIT 1`, [venueId]
    );
    if (clubsUsing.length > 0) {
      return NextResponse.redirect(
        new URL(`/admin/venues/${venueId}?error=Cannot delete: venue is assigned as primary ground for ${clubsUsing.length} club(s). Remove the assignment first.`, request.url),
        { status: 303 },
      );
    }

    await db.writeBatch([
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

    return NextResponse.redirect(
      new URL(`/admin/venues?deleted=1`, request.url),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
