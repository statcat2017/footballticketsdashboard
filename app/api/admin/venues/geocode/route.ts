import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/runtime-env";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.postcode !== "string" || body.postcode.trim().length === 0) {
    return NextResponse.json({ error: "Postcode is required." }, { status: 400 });
  }

  const postcode = body.postcode.replace(/\s+/g, "").toUpperCase();
  const postcodesIoBaseUrl = (await getCloudflareEnv("POSTCODES_IO_BASE_URL")) ?? "https://api.postcodes.io";

  try {
    const response = await fetch(`${postcodesIoBaseUrl}/postcodes/${postcode}`);
    if (!response.ok) {
      return NextResponse.json({ error: "Postcode not found." }, { status: 404 });
    }
    const data = await response.json();
    const latitude: number | undefined = data.result?.latitude;
    const longitude: number | undefined = data.result?.longitude;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Coordinates not available for this postcode." }, { status: 404 });
    }

    return NextResponse.json({ latitude, longitude });
  } catch {
    return NextResponse.json({ error: "Geocoding service unavailable." }, { status: 502 });
  }
}
