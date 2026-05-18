import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { divisionCodeFromName } from "@/lib/admin/clubs";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";

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
  const redirectDivisionIdStr = form.get("redirect_division_id");

  if (typeof divisionIdStr !== "string" || !/^\d+$/.test(divisionIdStr)) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid division ID.", request.url),
      { status: 303 }
    );
  }

  const divisionId = Number(divisionIdStr);
  const db = await getDatabase();

  const validRedirectDivId =
    typeof redirectDivisionIdStr === "string" && /^\d+$/.test(redirectDivisionIdStr)
      ? redirectDivisionIdStr
      : null;

  function redirectWith(params: Record<string, string>) {
    const url = new URL("/admin/publish", request.url);
    if (validRedirectDivId) url.searchParams.set("division_id", validRedirectDivId);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, { status: 303 });
  }

  try {
    const division = await db.get<{ id: number; name: string; level: number }>(
      `SELECT id, name, level FROM pyramid_divisions WHERE id = ?`,
      [divisionId]
    );

    if (!division) {
      return redirectWith({ error: "Division not found." });
    }

    const existingMapping = await db.get<{ id: number }>(
      `SELECT id FROM division_competition_mappings WHERE division_id = ?`,
      [divisionId]
    );

    if (existingMapping) {
      return redirectWith({ error: "Division already has a competition mapping." });
    }

    const code = divisionCodeFromName(division.name);

    const existingCompetition = await db.get<{ code: string }>(
      `SELECT code FROM competitions WHERE code = ?`,
      [code]
    );

    if (existingCompetition) {
      const after = {
        division_id: divisionId,
        competition_code: code,
        competition_name: division.name,
        note: "mapped to existing competition"
      };

      await db.writeBatch([
        {
          sql: `INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (?, ?)`,
          params: [divisionId, code]
        },
        buildAdminAuditLogWrite({
          action: "publish",
          entityType: "division_competition_mapping",
          entityId: divisionId,
          after
        })
      ]);

      return redirectWith({ success: `Division "${division.name}" mapped to existing competition "${code}".` });
    }

    const after = {
      code,
      name: division.name,
      tier: division.level,
      division_id: divisionId
    };

    await db.writeBatch([
      {
        sql: `INSERT INTO competitions (code, name, tier, kind) VALUES (?, ?, ?, 'league')`,
        params: [code, division.name, division.level]
      },
      {
        sql: `INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (?, ?)`,
        params: [divisionId, code]
      },
      buildAdminAuditLogWrite({
        action: "publish",
        entityType: "competition",
        entityId: code,
        after
      })
    ]);

    return redirectWith({ success: `Competition "${division.name}" published as "${code}".` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ error: message });
  }
}
