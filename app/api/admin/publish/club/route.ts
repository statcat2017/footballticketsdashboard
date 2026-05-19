import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getLatestSeasonId } from "@/lib/admin/clubs";
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

    const seasonId = await getLatestSeasonId(db);

    const membership = await db.get<{ competition_code: string | null }>(
      `SELECT dcm.competition_code
       FROM pyramid_season_memberships psm
       JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
       LEFT JOIN division_competition_mappings dcm ON dcm.division_id = psd.division_id
       WHERE psm.club_id = ? AND psm.season_id = ?`,
      [clubId, seasonId]
    );

    if (!membership) {
      return redirectWith({ error: "Club has no division membership. Assign it to a division first." });
    }

    if (!membership.competition_code) {
      return redirectWith({ error: "Division has no competition mapping. Publish the competition first." });
    }

    if (club.status === "known" && club.competition_code === membership.competition_code) {
      return redirectWith({ success: `Club "${club.name}" is already published.` });
    }

    const before = {
      name: club.name,
      competition_code: club.competition_code,
      status: club.status
    };

    const setClauses: string[] = [];
    const setParams: (string | number)[] = [];

    if (club.competition_code !== membership.competition_code) {
      setClauses.push("competition_code = ?");
      setParams.push(membership.competition_code);
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
          competition_code: membership.competition_code,
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
