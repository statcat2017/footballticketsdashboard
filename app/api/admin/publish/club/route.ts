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

  const clubIdStr = form.get("club_id");
  const redirectDivisionIdStr = form.get("redirect_division_id");

  if (typeof clubIdStr !== "string" || !/^\d+$/.test(clubIdStr)) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid club ID.", request.url),
      { status: 303 }
    );
  }

  const clubId = Number(clubIdStr);
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
    const club = await db.get<{ id: number; name: string; competition_code: string | null; status: string }>(
      `SELECT id, name, competition_code, status FROM clubs WHERE id = ?`,
      [clubId]
    );

    if (!club) {
      return redirectWith({ error: "Club not found." });
    }

    const friendlyClub = await db.get<{ id: number }>(
      `WITH
      friendly_clubs AS (
        SELECT c.id AS club_id FROM clubs c
        JOIN competitions comp ON comp.code = c.competition_code AND comp.kind = 'friendly'
        UNION
        SELECT f.home_club_id FROM fixtures f
        JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
        WHERE f.home_club_id IS NOT NULL
        UNION
        SELECT f.away_club_id FROM fixtures f
        JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
        WHERE f.away_club_id IS NOT NULL
      ),
      league_clubs AS (
        SELECT f.home_club_id AS club_id FROM fixtures f
        JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
        WHERE f.home_club_id IS NOT NULL
        UNION
        SELECT f.away_club_id FROM fixtures f
        JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
        WHERE f.away_club_id IS NOT NULL
      ),
      friendly_only_clubs AS (
        SELECT club_id FROM friendly_clubs
        EXCEPT
        SELECT club_id FROM league_clubs
      )
      SELECT c.id FROM clubs c
      WHERE c.id = ? AND c.id IN (SELECT club_id FROM friendly_only_clubs)`,
      [clubId]
    );

    if (friendlyClub) {
      return redirectWith({ error: "Friendly clubs cannot be published to pyramid competitions." });
    }

    const assignment = await db.get<{ competition_code: string | null }>(
      `SELECT dcm.competition_code
       FROM division_assignments da
       LEFT JOIN division_competition_mappings dcm ON dcm.division_id = da.division_id
       WHERE da.club_id = ?`,
      [clubId]
    );

    if (!assignment) {
      return redirectWith({ error: "Club has no division assignment. Assign it to a division first." });
    }

    if (!assignment.competition_code) {
      return redirectWith({ error: "Division has no competition mapping. Publish the competition first." });
    }

    if (club.status === "known" && club.competition_code === assignment.competition_code) {
      return redirectWith({ success: `Club "${club.name}" is already published.` });
    }

    const before = {
      name: club.name,
      competition_code: club.competition_code,
      status: club.status
    };

    const setClauses: string[] = [];
    const setParams: (string | number)[] = [];

    if (club.competition_code !== assignment.competition_code) {
      setClauses.push("competition_code = ?");
      setParams.push(assignment.competition_code);
    }

    if (club.status !== "known") {
      setClauses.push("status = 'known'");
    }

    setClauses.push("admin_updated_at = ?");
    setParams.push(new Date().toISOString());

    const statements: SqlWrite[] = [
      {
        sql: `UPDATE clubs SET ${setClauses.join(", ")} WHERE id = ?`,
        params: [...setParams, clubId]
      },
      buildAdminAuditLogWrite({
        action: "publish",
        entityType: "club",
        entityId: clubId,
        before,
        after: {
          name: club.name,
          competition_code: assignment.competition_code,
          status: "known"
        }
      })
    ];

    await db.writeBatch(statements);

    return redirectWith({ success: `Club "${club.name}" published.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ error: message });
  }
}
