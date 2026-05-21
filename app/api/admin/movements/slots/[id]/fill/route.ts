import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { fillSlot } from "@/lib/admin/movements";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const slotId = Number(id);

  if (!Number.isInteger(slotId) || slotId <= 0) {
    return NextResponse.json({ error: "Invalid slot ID." }, { status: 400 });
  }

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
  const clubId = typeof clubIdRaw === "string" ? Number(clubIdRaw) : NaN;
  if (!Number.isInteger(clubId) || clubId <= 0) {
    return NextResponse.json({ error: "Invalid club ID." }, { status: 400 });
  }

  const redirectTier = form.get("redirect_tier");
  const redirectPath = typeof redirectTier === "string" && redirectTier
    ? `/admin/movements/${redirectTier}`
    : "/admin/movements";

  const db = await getDatabase();

  try {
    const result = await fillSlot(db, slotId, clubId, session.actor);
    const params = new URLSearchParams();
    if (result.warnings.length > 0) {
      params.set("warning", result.warnings.join("; "));
    } else {
      params.set("success", "Slot filled.");
    }
    return NextResponse.redirect(
      new URL(`${redirectPath}?${params.toString()}`, request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`${redirectPath}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
