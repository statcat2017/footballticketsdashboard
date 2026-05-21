import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { applyAllFilledSlots } from "@/lib/admin/movements";
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

  const redirectTier = form.get("redirect_tier");
  const redirectPath = typeof redirectTier === "string" && redirectTier
    ? `/admin/movements/${redirectTier}`
    : "/admin/movements";

  const db = await getDatabase();

  try {
    const applied = await applyAllFilledSlots(db, session.actor);
    const params = new URLSearchParams();
    if (applied > 0) {
      params.set("success", `Applied ${applied} movement${applied !== 1 ? "s" : ""}.`);
    } else {
      params.set("info", "No movements to apply.");
    }
    return adminRedirect(request, `${redirectPath}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return adminRedirect(request, `${redirectPath}?error=${encodeURIComponent(message)}`);
  }
}
