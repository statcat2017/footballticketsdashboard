import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import type { SqlWrite } from "@/lib/db/adapter";

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
    const divisionMapping = await db.get<{ competition_code: string }>(
      `SELECT dcm.competition_code
       FROM division_competition_mappings dcm
       WHERE dcm.division_id = ?`,
      [divisionId]
    );

    if (!divisionMapping) {
      return redirectWith({ error: "Division has no competition mapping. Publish the competition first." });
    }

    const clubs = await db.all<{
      id: number;
      name: string;
      competition_code: string | null;
      status: string;
    }>(
      `SELECT c.id, c.name, c.competition_code, c.status
       FROM division_assignments da
       JOIN clubs c ON c.id = da.club_id
       WHERE da.division_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM competitions comp
           WHERE comp.code = c.competition_code AND comp.kind = 'friendly'
         )
         AND NOT (
           EXISTS (
             SELECT 1
             FROM fixtures f
             JOIN competitions comp ON comp.code = f.competition_code
             WHERE comp.kind = 'friendly'
               AND (f.home_club_id = c.id OR f.away_club_id = c.id)
           )
           AND NOT EXISTS (
             SELECT 1
             FROM fixtures f
             JOIN competitions comp ON comp.code = f.competition_code
             WHERE comp.kind != 'friendly'
               AND (f.home_club_id = c.id OR f.away_club_id = c.id)
           )
         )
       ORDER BY c.name`,
      [divisionId]
    );

    if (clubs.length === 0) {
      return redirectWith({ error: "No clubs found in this division." });
    }

    const statements: SqlWrite[] = [];
    const updated: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const now = new Date().toISOString();

    for (const club of clubs) {
      if (club.status === "known" && club.competition_code === divisionMapping.competition_code) {
        skipped.push({ name: club.name, reason: "Already published" });
        continue;
      }

      const setClauses: string[] = [];
      const setParams: (string | number)[] = [];

      if (club.competition_code !== divisionMapping.competition_code) {
        setClauses.push("competition_code = ?");
        setParams.push(divisionMapping.competition_code);
      }

      if (club.status !== "known") {
        setClauses.push("status = 'known'");
      }

      setClauses.push("admin_updated_at = ?");
      setParams.push(now);

      statements.push({
        sql: `UPDATE clubs SET ${setClauses.join(", ")} WHERE id = ?`,
        params: [...setParams, club.id]
      });

      statements.push(buildAdminAuditLogWrite({
        action: "publish",
        entityType: "club",
        entityId: club.id,
        before: {
          name: club.name,
          competition_code: club.competition_code,
          status: club.status
        },
        after: {
          name: club.name,
          competition_code: divisionMapping.competition_code,
          status: "known"
        }
      }));

      updated.push(club.name);
    }

    if (statements.length === 0) {
      return redirectWith({ error: "No clubs to publish." });
    }

    await db.writeBatch(statements);

    let summary = `Published ${updated.length} club${updated.length > 1 ? "s" : ""}: ${updated.join(", ")}.`;
    if (skipped.length > 0) {
      summary += ` Skipped ${skipped.length}: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.`;
    }

    return redirectWith({ success: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ error: message });
  }
}
