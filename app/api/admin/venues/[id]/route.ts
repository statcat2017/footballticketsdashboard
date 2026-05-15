import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminVenue, updateAdminVenue } from "@/lib/admin/venues";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const venueId = Number(id);

  if (!Number.isInteger(venueId) || venueId <= 0) {
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

  const venueRow = await getAdminVenue(venueId);

  if (!venueRow) {
    return NextResponse.redirect(
      new URL("/admin/venues?error=Venue not found.", request.url),
      { status: 303 }
    );
  }

  const confirmed = form.get("confirmed") === "true";

  const name = form.get("name");
  const postcode = form.get("postcode");
  const latitude = form.get("latitude");
  const longitude = form.get("longitude");
  const isApproximate = form.get("is_approximate");

  try {
    await updateAdminVenue(venueId, {
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      postcode: typeof postcode === "string" && postcode.length > 0 ? postcode : undefined,
      latitude: typeof latitude === "string" ? parseFloat(latitude) : undefined,
      longitude: typeof longitude === "string" ? parseFloat(longitude) : undefined,
      is_approximate: isApproximate === "1" ? 1 : isApproximate === "0" ? 0 : undefined
    }, confirmed);

    return NextResponse.redirect(new URL(`/admin/venues/${venueId}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
