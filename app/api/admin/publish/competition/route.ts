import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { divisionCodeFromName } from "@/lib/admin/clubs";
import { writeAdminAuditLog } from "@/lib/admin/audit";

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

  const divisionIdStr = form.get("division_id");

  if (typeof divisionIdStr !== "string" || !/^\d+$/.test(divisionIdStr)) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid division ID.", request.url),
      { status: 303 }
    );
  }

  const divisionId = Number(divisionIdStr);
  const db = await getDatabase();

  try {
    const division = await db.get<{ id: number; name: string; level: number }>(
      `SELECT id, name, level FROM pyramid_divisions WHERE id = ?`,
      [divisionId]
    );

    if (!division) {
      return NextResponse.redirect(
        new URL("/admin/publish?error=Division not found.", request.url),
        { status: 303 }
      );
    }

    const existingMapping = await db.get<{ id: number }>(
      `SELECT id FROM division_competition_mappings WHERE division_id = ?`,
      [divisionId]
    );

    if (existingMapping) {
      return NextResponse.redirect(
        new URL("/admin/publish?error=Division already has a competition mapping.", request.url),
        { status: 303 }
      );
    }

    const code = divisionCodeFromName(division.name);

    const existingCompetition = await db.get<{ id: number }>(
      `SELECT id FROM competitions WHERE code = ?`,
      [code]
    );

    if (existingCompetition) {
      return NextResponse.redirect(
        new URL(`/admin/publish?error=Competition code "${code}" already exists.`, request.url),
        { status: 303 }
      );
    }

    const competitionResult = await db.run(
      `INSERT INTO competitions (code, name, tier) VALUES (?, ?, ?)`,
      [code, division.name, division.level]
    );

    await db.run(
      `INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (?, ?)`,
      [divisionId, code]
    );

    await writeAdminAuditLog(db, {
      action: "publish",
      entityType: "competition",
      entityId: competitionResult.lastInsertRowid,
      after: {
        code,
        name: division.name,
        tier: division.level,
        division_id: divisionId
      }
    });

    return NextResponse.redirect(
      new URL(`/admin/publish?success=Competition "${division.name}" published as "${code}".`, request.url),
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
