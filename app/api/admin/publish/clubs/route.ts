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
    const seasonId = await getLatestSeasonId(db);

    const divisionMapping = await db.get<{ competition_code: string }>(
      `SELECT dcm.competition_code
       FROM pyramid_season_divisions psd
       JOIN division_competition_mappings dcm ON dcm.division_id = psd.division_id
       WHERE psd.season_id = ? AND dcm.division_id = ?`,
      [seasonId, divisionId]
    );

    if (!divisionMapping) {
      return redirectWith({ error: "Division has no competition mapping. Publish the competition first." });
    }

    const clubs = await db.all<{
      id: number;
      name: string;
      aliases: string | null;
      venue_id: number | null;
      venue_name: string | null;
      club_mapping_id: number | null;
      existing_club_id: number | null;
      existing_club_comp: string | null;
      existing_club_venue_id: number | null;
      existing_mapping_id: number | null;
    }>(
      `SELECT
        pc.id,
        pc.name,
        pc.aliases,
        v.id AS venue_id,
        v.name AS venue_name,
        cm.id AS club_mapping_id,
        ec.id AS existing_club_id,
        ec.competition_code AS existing_club_comp,
        ec.venue_id AS existing_club_venue_id,
        ecm.id AS existing_mapping_id
      FROM pyramid_season_memberships psm
      JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
      JOIN pyramid_clubs pc ON pc.id = psm.club_id
      LEFT JOIN club_venue_assignments cva
        ON cva.club_id = pc.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
      LEFT JOIN venues v ON v.id = cva.venue_id
      LEFT JOIN club_mappings cm ON cm.pyramid_club_id = pc.id
      LEFT JOIN clubs ec ON ec.name = pc.name
      LEFT JOIN club_mappings ecm ON ecm.club_id = ec.id
      WHERE psm.season_id = ? AND psd.division_id = ?
      ORDER BY pc.name`,
      [seasonId, divisionId]
    );

    type ClubAction = "publish_new" | "map_existing" | "skip_already_published" | "skip_no_venue" | "skip_conflict";
    interface EligibleClub {
      club: typeof clubs[number];
      action: ClubAction;
    }

    const eligible: EligibleClub[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const club of clubs) {
      if (club.club_mapping_id !== null) {
        skipped.push({ name: club.name, reason: "Already published" });
        continue;
      }

      if (!club.venue_id) {
        skipped.push({ name: club.name, reason: "No primary venue" });
        continue;
      }

      if (club.existing_club_id !== null) {
        if (club.existing_mapping_id !== null) {
          skipped.push({ name: club.name, reason: "Public club already mapped to another pyramid club" });
          continue;
        }

        if (club.existing_club_comp !== divisionMapping.competition_code) {
          skipped.push({ name: club.name, reason: "Competition code mismatch for existing public club" });
          continue;
        }

        if (club.existing_club_venue_id !== club.venue_id) {
          skipped.push({ name: club.name, reason: "Venue mismatch for existing public club" });
          continue;
        }

        eligible.push({ club, action: "map_existing" });
      } else {
        eligible.push({ club, action: "publish_new" });
      }
    }

    if (eligible.length === 0) {
      let msg = "No clubs to publish.";
      if (skipped.length > 0) {
        msg += ` Skipped: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.`;
      }
      return redirectWith({ error: msg });
    }

    const statements: SqlWrite[] = [];

    for (const entry of eligible) {
      const club = entry.club;

      if (entry.action === "publish_new") {
        statements.push({
          sql: `INSERT INTO clubs (name, aliases, competition_code, venue_id) VALUES (?, ?, ?, ?)`,
          params: [club.name, club.aliases, divisionMapping.competition_code, club.venue_id]
        });

        const after = {
          name: club.name,
          aliases: club.aliases,
          competition_code: divisionMapping.competition_code,
          venue_id: club.venue_id,
          venue_name: club.venue_name,
          pyramid_club_id: club.id
        };

        statements.push({
          sql: `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, (SELECT id FROM clubs WHERE name = ?))`,
          params: [club.id, club.name]
        });

        statements.push(buildAdminAuditLogWrite({
          action: "publish",
          entityType: "club",
          entityId: club.id,
          after
        }));
      } else if (entry.action === "map_existing") {
        const after = {
          name: club.name,
          pyramid_club_id: club.id,
          club_id: club.existing_club_id,
          note: "mapped to existing public club"
        };

        statements.push({
          sql: `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, ?)`,
          params: [club.id, club.existing_club_id]
        });

        statements.push(buildAdminAuditLogWrite({
          action: "publish",
          entityType: "club_mapping",
          entityId: club.existing_club_id,
          after
        }));
      }
    }

    await db.writeBatch(statements);

    let summary = `Published ${eligible.length} club${eligible.length > 1 ? "s" : ""}.`;
    if (skipped.length > 0) {
      summary += ` Skipped ${skipped.length}: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.`;
    }

    return redirectWith({ success: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ error: message });
  }
}
