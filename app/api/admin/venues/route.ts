import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { createAdminVenue } from "@/lib/admin/venues";

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

  const name = form.get("name");
  const postcode = form.get("postcode");
  const latitude = form.get("latitude");
  const longitude = form.get("longitude");
  const isApproximate = form.get("is_approximate");
  const coordinatePrecision = form.get("coordinate_precision");

  if (typeof name !== "string" || name.length === 0) {
    return NextResponse.redirect(
      new URL("/admin/venues/new?error=Venue name is required.", request.url),
      { status: 303 }
    );
  }

  if (typeof postcode !== "string" || postcode.length === 0) {
    return NextResponse.redirect(
      new URL("/admin/venues/new?error=Postcode is required.", request.url),
      { status: 303 }
    );
  }

  const latNum = typeof latitude === "string" ? Number(latitude) : NaN;
  const lngNum = typeof longitude === "string" ? Number(longitude) : NaN;

  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    return NextResponse.redirect(
      new URL("/admin/venues/new?error=Invalid latitude. Must be between -90 and 90.", request.url),
      { status: 303 }
    );
  }

  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    return NextResponse.redirect(
      new URL("/admin/venues/new?error=Invalid longitude. Must be between -180 and 180.", request.url),
      { status: 303 }
    );
  }

  try {
    const venueId = await createAdminVenue({
      name,
      postcode,
      latitude: latNum,
      longitude: lngNum,
      is_approximate: isApproximate === "1" ? 1 : 0,
      coordinate_precision: typeof coordinatePrecision === "string" && coordinatePrecision.length > 0
        ? coordinatePrecision
        : undefined
    });

    return NextResponse.redirect(new URL(`/admin/venues/${venueId}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/venues/new?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
