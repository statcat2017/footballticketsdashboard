import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getLatestSeasonId } from "@/lib/admin/clubs";
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

  const pyramidClubIdStr = form.get("pyramid_club_id");
  const redirectDivisionIdStr = form.get("redirect_division_id");

  if (typeof pyramidClubIdStr !== "string" || !/^\d+$/.test(pyramidClubIdStr)) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid pyramid club ID.", request.url),
      { status: 303 }
    );
  }

  const pyramidClubId = Number(pyramidClubIdStr);
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
    const pyramidClub = await db.get<{ id: number; name: string; aliases: string | null }>(
      `SELECT id, name, aliases FROM pyramid_clubs WHERE id = ?`,
      [pyramidClubId]
    );

    if (!pyramidClub) {
      return redirectWith({ error: "Pyramid club not found." });
    }

    const existingMapping = await db.get<{ id: number }>(
      `SELECT id FROM club_mappings WHERE pyramid_club_id = ?`,
      [pyramidClubId]
    );

    if (existingMapping) {
      return redirectWith({ error: "Club already published." });
    }

    const venue = await db.get<{ id: number; name: string; postcode: string }>(
      `SELECT v.id, v.name, v.postcode
       FROM club_venue_assignments cva
       JOIN venues v ON v.id = cva.venue_id
       WHERE cva.club_id = ? AND cva.is_primary = 1 AND cva.effective_to IS NULL`,
      [pyramidClubId]
    );

    if (!venue) {
      return redirectWith({ error: "Pyramid club has no primary venue. Create a venue first." });
    }

    const seasonId = await getLatestSeasonId(db);

    const divisionMapping = await db.get<{ competition_code: string }>(
      `SELECT dcm.competition_code
       FROM pyramid_season_memberships psm
       JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
       JOIN division_competition_mappings dcm ON dcm.division_id = psd.division_id
       WHERE psm.club_id = ? AND psm.season_id = ?`,
      [pyramidClubId, seasonId]
    );

    if (!divisionMapping) {
      return redirectWith({ error: "Division has no competition mapping. Publish the competition first." });
    }

    const existingClub = await db.get<{ id: number; competition_code: string; venue_id: number }>(
      `SELECT id, competition_code, venue_id FROM clubs WHERE name = ?`,
      [pyramidClub.name]
    );

    if (existingClub) {
      const existingClubMapping = await db.get<{ pyramid_club_id: number }>(
        `SELECT pyramid_club_id FROM club_mappings WHERE club_id = ?`,
        [existingClub.id]
      );

      if (existingClubMapping) {
        return redirectWith({
          error: `Public club "${pyramidClub.name}" is already mapped to pyramid club ID ${existingClubMapping.pyramid_club_id}.`
        });
      }

      if (existingClub.competition_code !== divisionMapping.competition_code) {
        return redirectWith({
          error: `Existing club "${pyramidClub.name}" has competition "${existingClub.competition_code}" but this division maps to "${divisionMapping.competition_code}".`
        });
      }

      if (existingClub.venue_id !== venue.id) {
        return redirectWith({
          error: `Existing club "${pyramidClub.name}" has venue ID ${existingClub.venue_id} but "${pyramidClub.name}" uses venue ID ${venue.id} ("${venue.name}").`
        });
      }

      const after = {
        name: pyramidClub.name,
        pyramid_club_id: pyramidClubId,
        club_id: existingClub.id,
        note: "mapped to existing public club"
      };

      await db.writeBatch([
        {
          sql: `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, ?)`,
          params: [pyramidClubId, existingClub.id]
        },
        buildAdminAuditLogWrite({
          action: "publish",
          entityType: "club_mapping",
          entityId: existingClub.id,
          after
        })
      ]);

      return redirectWith({ success: `Club "${pyramidClub.name}" mapped to existing public club.` });
    }

    // Publish new club
    const clubResult = await db.run(
      `INSERT INTO clubs (name, aliases, competition_code, venue_id) VALUES (?, ?, ?, ?)`,
      [pyramidClub.name, pyramidClub.aliases, divisionMapping.competition_code, venue.id]
    );

    const newClubId = clubResult.lastInsertRowid;
    if (!newClubId) throw new Error("Failed to create club record.");

    const after = {
      name: pyramidClub.name,
      aliases: pyramidClub.aliases,
      competition_code: divisionMapping.competition_code,
      venue_id: venue.id,
      venue_name: venue.name,
      pyramid_club_id: pyramidClubId
    };

    await db.writeBatch([
      {
        sql: `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, ?)`,
        params: [pyramidClubId, newClubId]
      },
      buildAdminAuditLogWrite({
        action: "publish",
        entityType: "club",
        entityId: newClubId,
        after
      })
    ]);

    return redirectWith({ success: `Club "${pyramidClub.name}" published.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ error: message });
  }
}
