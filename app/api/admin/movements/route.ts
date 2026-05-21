import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getMovementViewData } from "@/lib/admin/movements";

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tierMin = Number(url.searchParams.get("tierMin") ?? "1");
  const tierMax = Number(url.searchParams.get("tierMax") ?? "10");

  if (!Number.isInteger(tierMin) || !Number.isInteger(tierMax) || tierMin < 1 || tierMax > 10 || tierMin > tierMax) {
    return NextResponse.json({ error: "Invalid tier range." }, { status: 400 });
  }

  const db = await getDatabase();
  const data = await getMovementViewData(db, tierMin, tierMax);

  return NextResponse.json(data);
}
