import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { moveClubToDivision } from "@/lib/admin/divisionAssignments";

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
  const divisionIdRaw = form.get("division_id");

  const clubId = typeof clubIdRaw === "string" ? Number(clubIdRaw) : NaN;
  const divisionId = typeof divisionIdRaw === "string" ? Number(divisionIdRaw) : NaN;

  if (!Number.isInteger(clubId) || clubId <= 0) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid club ID.", request.url),
      { status: 303 }
    );
  }

  if (!Number.isInteger(divisionId) || divisionId <= 0) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid division ID.", request.url),
      { status: 303 }
    );
  }

  const db = await getDatabase();

  try {
    const result = await moveClubToDivision(db, clubId, divisionId, session.actor);
    const params = new URLSearchParams();
    if (result.warning) {
      params.set("warning", result.warning);
    } else {
      params.set("success", "Club moved.");
    }
    return NextResponse.redirect(
      new URL(`/admin/publish?${params.toString()}`, request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/publish?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
