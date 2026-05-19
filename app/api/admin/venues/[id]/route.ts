import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
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

  const db = await getDatabase();
  const venueRow = await getAdminVenue(db, venueId);

  if (!venueRow) {
    return NextResponse.redirect(
      new URL("/admin/venues?error=Venue not found.", request.url),
      { status: 303 }
    );
  }

  const confirmed = form.get("confirmed") === "true";
  const coordsConfirmed = form.get("coords_confirmed") === "true";

  const name = form.get("name");
  const postcode = form.get("postcode");
  const latitude = form.get("latitude");
  const longitude = form.get("longitude");
  const coordinatePrecision = form.get("coordinate_precision");
  const coordinatesNotes = form.get("coordinates_notes");

  const latNum = typeof latitude === "string" ? Number(latitude) : NaN;
  const lngNum = typeof longitude === "string" ? Number(longitude) : NaN;

  if (
    !Number.isFinite(latNum) || latNum < -90 || latNum > 90 ||
    !Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180
  ) {
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=Invalid coordinates.`, request.url),
      { status: 303 }
    );
  }

  const coordsChanged =
    latNum !== venueRow.venue.latitude || lngNum !== venueRow.venue.longitude;

  if (coordsChanged && !coordsConfirmed) {
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=Coordinate confirmation required when changing coordinates.`, request.url),
      { status: 303 }
    );
  }

  const coordPrecision = typeof coordinatePrecision === "string" && coordinatePrecision.length > 0
    ? coordinatePrecision
    : undefined;

  try {
    const result = await updateAdminVenue(db, venueId, {
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      postcode: typeof postcode === "string" && postcode.length > 0 ? postcode : undefined,
      latitude: latNum,
      longitude: lngNum,
      is_approximate: form.get("is_approximate") === "1" ? 1 : 0,
      coordinate_precision: coordPrecision,
      coordinates_notes: typeof coordinatesNotes === "string" ? coordinatesNotes : undefined,
    }, confirmed);

    const searchParams = new URLSearchParams();
    if (result.invalidatedTravelCount > 0) {
      searchParams.set("travelInvalidated", String(result.invalidatedTravelCount));
    }

    const redirectUrl = `/admin/venues/${venueId}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    return NextResponse.redirect(new URL(redirectUrl, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/venues/${venueId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
