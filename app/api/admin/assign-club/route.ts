import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { assignClubToDivision } from "@/lib/admin/divisionAssignments";
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
  const divisionIdRaw = form.get("division_id");
  const redirectDivisionIdRaw = form.get("redirect_division_id");

  const clubId = typeof clubIdRaw === "string" ? Number(clubIdRaw) : NaN;
  const divisionId = typeof divisionIdRaw === "string" ? Number(divisionIdRaw) : NaN;
  const redirectDivisionId = typeof redirectDivisionIdRaw === "string" && /^\d+$/.test(redirectDivisionIdRaw)
    ? redirectDivisionIdRaw
    : null;

  if (!Number.isInteger(clubId) || clubId <= 0) {
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=Invalid+club+ID.`);
  }

  if (!Number.isInteger(divisionId) || divisionId <= 0) {
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=Invalid+division+ID.`);
  }

  const db = await getDatabase();

  try {
    const result = await assignClubToDivision(db, clubId, divisionId, session.actor);
    const params = new URLSearchParams();
    if (result.warning) {
      params.set("warning", result.warning);
    } else {
      params.set("success", "Club assigned.");
    }
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=${encodeURIComponent(message)}`);
  }
}
