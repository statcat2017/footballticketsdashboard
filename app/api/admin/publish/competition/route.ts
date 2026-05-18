import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { divisionCodeFromName } from "@/lib/admin/clubs";

const ADMIN_ACTOR = "admin";

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

  function baseUrl(): string {
    let path = "/admin/publish";
    if (typeof redirectDivisionIdStr === "string" && /^\d+$/.test(redirectDivisionIdStr)) {
      path += `?division_id=${redirectDivisionIdStr}`;
    }
    return path;
  }

  function redirectTo(path: string, extraParams: string): URL {
    const sep = path.includes("?") ? "&" : "?";
    return new URL(`${path}${sep}${extraParams}`, request.url);
  }

  try {
    const division = await db.get<{ id: number; name: string; level: number }>(
      `SELECT id, name, level FROM pyramid_divisions WHERE id = ?`,
      [divisionId]
    );

    if (!division) {
      return NextResponse.redirect(
        redirectTo(baseUrl(), "error=Division not found."),
        { status: 303 }
      );
    }

    const existingMapping = await db.get<{ id: number }>(
      `SELECT id FROM division_competition_mappings WHERE division_id = ?`,
      [divisionId]
    );

    if (existingMapping) {
      return NextResponse.redirect(
        redirectTo(baseUrl(), "error=Division already has a competition mapping."),
        { status: 303 }
      );
    }

    const code = divisionCodeFromName(division.name);

    const existingCompetition = await db.get<{ code: string; id: number }>(
      `SELECT code, id FROM competitions WHERE code = ?`,
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
        {
          sql: `INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)`,
          params: [ADMIN_ACTOR, "publish", "division_competition_mapping", String(divisionId), null, JSON.stringify(after)]
        }
      ]);

      return NextResponse.redirect(
        redirectTo(baseUrl(), `success=Division "${division.name}" mapped to existing competition "${code}".`),
        { status: 303 }
      );
    }

    const competitionResult = await db.run(
      `INSERT INTO competitions (code, name, tier) VALUES (?, ?, ?)`,
      [code, division.name, division.level]
    );

    const newCompetitionId = competitionResult.lastInsertRowid;

    const after = {
      code,
      name: division.name,
      tier: division.level,
      division_id: divisionId
    };

    await db.writeBatch([
      {
        sql: `INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (?, ?)`,
        params: [divisionId, code]
      },
      {
        sql: `INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [ADMIN_ACTOR, "publish", "competition", String(newCompetitionId), null, JSON.stringify(after)]
      }
    ]);

    return NextResponse.redirect(
      redirectTo(baseUrl(), `success=Competition "${division.name}" published as "${code}".`),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      redirectTo(baseUrl(), `error=${encodeURIComponent(message)}`),
      { status: 303 }
    );
  }
}
