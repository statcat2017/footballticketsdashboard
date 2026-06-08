import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { getEnv } from "@/lib/runtime-env";

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

  const body = await request.json().catch(() => null);

  if (!body || typeof body.postcode !== "string" || body.postcode.trim().length === 0) {
    return NextResponse.json({ error: "Postcode is required." }, { status: 400 });
  }

  const postcode = body.postcode.replace(/\s+/g, "").toUpperCase();
  const postcodesIoBaseUrl = getEnv("POSTCODES_IO_BASE_URL") ?? "https://api.postcodes.io";

  try {
    const response = await fetch(`${postcodesIoBaseUrl}/postcodes/${postcode}`);

    if (!response.ok) {
      return NextResponse.json({ error: "Postcode not found." }, { status: 404 });
    }

    const data = await response.json();
    const lat: number | undefined = data.result?.latitude;
    const lng: number | undefined = data.result?.longitude;

    if (lat == null || lng == null) {
      return NextResponse.json({ error: "Coordinates not available for this postcode." }, { status: 404 });
    }

    return NextResponse.json({
      latitude: lat,
      longitude: lng,
      source: "api" as const
    });
  } catch {
    return NextResponse.json({ error: "Geocoding service unavailable." }, { status: 503 });
  }
}
