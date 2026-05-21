import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { moveClubWithSwap, unassignClubFromTier10 } from "@/lib/admin/divisionAssignments";
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
  const targetDivisionIdRaw = form.get("target_division_id");
  const swapClubIdRaw = form.get("swap_club_id");
  const movementTypeRaw = form.get("movement_type");
  const redirectDivisionIdRaw = form.get("redirect_division_id");

  const clubId = typeof clubIdRaw === "string" ? Number(clubIdRaw) : NaN;
  const movementType = typeof movementTypeRaw === "string" ? movementTypeRaw : "";
  const redirectDivisionId = typeof redirectDivisionIdRaw === "string" && /^\d+$/.test(redirectDivisionIdRaw)
    ? redirectDivisionIdRaw
    : null;

  if (!Number.isInteger(clubId) || clubId <= 0) {
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=Invalid+club+ID.`);
  }

  if (!["promote", "relegate", "migrate"].includes(movementType)) {
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=Invalid+movement+type.`);
  }

  const db = await getDatabase();

  try {
    const isEmptyTarget = targetDivisionIdRaw === "" || targetDivisionIdRaw === null || targetDivisionIdRaw === undefined;

    if (movementType === "relegate" && isEmptyTarget) {
      await unassignClubFromTier10(db, clubId, session.actor);
      const params = new URLSearchParams("success=Club+unassigned+(relegated+below+tier+10).");
      const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
      return adminRedirect(request, `${redirectPath}?${params.toString()}`);
    }

    const targetDivisionId = typeof targetDivisionIdRaw === "string" ? Number(targetDivisionIdRaw) : NaN;

    if (!Number.isInteger(targetDivisionId) || targetDivisionId <= 0) {
      const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
      return adminRedirect(request, `${redirectPath}?error=Invalid+target+division.`);
    }

    const swapClubId = typeof swapClubIdRaw === "string" && swapClubIdRaw !== ""
      ? Number(swapClubIdRaw)
      : null;

    const result = await moveClubWithSwap(
      db,
      clubId,
      targetDivisionId,
      swapClubId,
      movementType as "promote" | "relegate" | "migrate",
      session.actor
    );

    const params = new URLSearchParams();
    if (result.warning) params.set("warning", result.warning);
    else params.set("success", `Club ${movementType}d.`);
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = redirectDivisionId ? `/admin/publish/${redirectDivisionId}` : "/admin/publish";
    return adminRedirect(request, `${redirectPath}?error=${encodeURIComponent(message)}`);
  }
}
