import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { createSlots } from "@/lib/admin/movements";
import type { MovementType } from "@/lib/admin/movements";
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

  const sourceRaw = form.get("source_division_id");
  const targetRaw = form.get("target_division_id");
  const countRaw = form.get("count");
  const movementTypeRaw = form.get("movement_type");
  const redirectTier = form.get("redirect_tier");

  const sourceDivisionId = typeof sourceRaw === "string" ? Number(sourceRaw) : NaN;
  const targetDivisionId = typeof targetRaw === "string" ? Number(targetRaw) : NaN;
  const count = typeof countRaw === "string" ? Number(countRaw) : NaN;
  const movementType = typeof movementTypeRaw === "string" ? movementTypeRaw : "";

  if (!Number.isInteger(sourceDivisionId) || sourceDivisionId <= 0) {
    return NextResponse.json({ error: "Invalid source division ID." }, { status: 400 });
  }
  if (!Number.isInteger(targetDivisionId) || targetDivisionId <= 0) {
    return NextResponse.json({ error: "Invalid target division ID." }, { status: 400 });
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return NextResponse.json({ error: "Count must be between 1 and 50." }, { status: 400 });
  }
  if (!["promotion", "relegation", "migration"].includes(movementType)) {
    return NextResponse.json({ error: "Invalid movement type." }, { status: 400 });
  }

  const db = await getDatabase();

  try {
    const result = await createSlots(
      db,
      sourceDivisionId,
      targetDivisionId,
      movementType as MovementType,
      count,
      session.actor
    );

    const redirectPath = typeof redirectTier === "string" && redirectTier
      ? `/admin/movements/${redirectTier}`
      : "/admin/movements";

    const params = new URLSearchParams();
    if (result.created > 0) {
      params.set("success", `Created ${result.created} slot${result.created !== 1 ? "s" : ""}.`);
      if (result.skipped > 0) {
        params.set("warning", `${result.skipped} slot${result.skipped !== 1 ? "s" : ""} already existed and were skipped.`);
      }
    } else {
      params.set("info", `${result.skipped} slot${result.skipped !== 1 ? "s" : ""} already existed.`);
    }

    return adminRedirect(request, `${redirectPath}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = typeof redirectTier === "string" && redirectTier
      ? `/admin/movements/${redirectTier}`
      : "/admin/movements";
    return adminRedirect(request, `${redirectPath}?error=${encodeURIComponent(message)}`);
  }
}
