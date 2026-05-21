import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { assignAdminVenue, isValidDate } from "@/lib/admin/venues";
import { adminRedirect } from "@/lib/admin/redirect";

export async function POST(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);

  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const csrf = form.get("csrf");

  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const clubIdRaw = form.get("club_id");
  const venueIdRaw = form.get("venue_id");
  const effectiveFrom = form.get("effective_from");

  const clubId = typeof clubIdRaw === "string" ? Number(clubIdRaw) : NaN;
  const venueId = typeof venueIdRaw === "string" ? Number(venueIdRaw) : NaN;

  if (!Number.isInteger(clubId) || clubId <= 0) {
    return adminRedirect(request, `/admin/clubs?error=Invalid club ID.`);
  }

  if (!Number.isInteger(venueId) || venueId <= 0) {
    return adminRedirect(request, `/admin/clubs/${clubId}?error=Invalid venue ID.`);
  }

  if (typeof effectiveFrom !== "string" || !isValidDate(effectiveFrom)) {
    return adminRedirect(request, `/admin/clubs/${clubId}?error=Valid effective date (YYYY-MM-DD) is required.`);
  }

  const db = await getDatabase();

  try {
    await assignAdminVenue(db, clubId, venueId, effectiveFrom);

    return adminRedirect(request, `/admin/clubs/${clubId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return adminRedirect(request, `/admin/clubs/${clubId}?error=${encodeURIComponent(message)}`);
  }
}
