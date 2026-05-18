import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getLatestSeasonId } from "@/lib/admin/clubs";
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

  const pyramidClubIdStr = form.get("pyramid_club_id");

  if (typeof pyramidClubIdStr !== "string" || !/^\d+$/.test(pyramidClubIdStr)) {
    return NextResponse.redirect(
      new URL("/admin/publish?error=Invalid pyramid club ID.", request.url),
      { status: 303 }
    );
  }

  const pyramidClubId = Number(pyramidClubIdStr);
  const db = await getDatabase();

  try {
    const pyramidClub = await db.get<{ id: number; name: string; aliases: string | null }>(
      `SELECT id, name, aliases FROM pyramid_clubs WHERE id = ?`,
      [pyramidClubId]
    );

    if (!pyramidClub) {
      return NextResponse.redirect(
        new URL("/admin/publish?error=Pyramid club not found.", request.url),
        { status: 303 }
      );
    }

    const existingMapping = await db.get<{ id: number }>(
      `SELECT id FROM club_mappings WHERE pyramid_club_id = ?`,
      [pyramidClubId]
    );

    if (existingMapping) {
      return NextResponse.redirect(
        new URL("/admin/publish?error=Club already published.", request.url),
        { status: 303 }
      );
    }

    const venue = await db.get<{ id: number; name: string; postcode: string }>(
      `SELECT v.id, v.name, v.postcode
       FROM club_venue_assignments cva
       JOIN venues v ON v.id = cva.venue_id
       WHERE cva.club_id = ? AND cva.is_primary = 1 AND cva.effective_to IS NULL`,
      [pyramidClubId]
    );

    if (!venue) {
      return NextResponse.redirect(
        new URL("/admin/publish?error=Pyramid club has no primary venue. Create a venue first.", request.url),
        { status: 303 }
      );
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
      return NextResponse.redirect(
        new URL("/admin/publish?error=Division has no competition mapping. Publish the competition first.", request.url),
        { status: 303 }
      );
    }

    const existingClub = await db.get<{ id: number; competition_code: string | null; venue_id: number | null }>(
      `SELECT id, competition_code, venue_id FROM clubs WHERE name = ?`,
      [pyramidClub.name]
    );

    if (existingClub) {
      if (!existingClub.competition_code) {
        return NextResponse.redirect(
          new URL(`/admin/publish?error=Existing club "${pyramidClub.name}" is missing a competition_code.`, request.url),
          { status: 303 }
        );
      }

      if (!existingClub.venue_id) {
        return NextResponse.redirect(
          new URL(`/admin/publish?error=Existing club "${pyramidClub.name}" is missing a venue_id.`, request.url),
          { status: 303 }
        );
      }

      await db.transaction(async (txDb) => {
        await txDb.run(
          `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, ?)`,
          [pyramidClubId, existingClub.id]
        );

        await writeAdminAuditLog(txDb, {
          action: "publish",
          entityType: "club_mapping",
          entityId: existingClub.id,
          after: {
            name: pyramidClub.name,
            pyramid_club_id: pyramidClubId,
            club_id: existingClub.id,
            note: "mapped to existing public club"
          }
        });
      });

      return NextResponse.redirect(
        new URL(`/admin/publish?success=Club "${pyramidClub.name}" mapped to existing public club.`, request.url),
        { status: 303 }
      );
    }

    // Publish new club
    await db.transaction(async (txDb) => {
      const clubResult = await txDb.run(
        `INSERT INTO clubs (name, aliases, competition_code, venue_id) VALUES (?, ?, ?, ?)`,
        [pyramidClub.name, pyramidClub.aliases, divisionMapping.competition_code, venue.id]
      );

      const newClubId = clubResult.lastInsertRowid;
      if (!newClubId) throw new Error("Failed to create club record.");

      await txDb.run(
        `INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (?, ?)`,
        [pyramidClubId, newClubId]
      );

      await writeAdminAuditLog(txDb, {
        action: "publish",
        entityType: "club",
        entityId: newClubId,
        after: {
          name: pyramidClub.name,
          aliases: pyramidClub.aliases,
          competition_code: divisionMapping.competition_code,
          venue_id: venue.id,
          venue_name: venue.name,
          pyramid_club_id: pyramidClubId
        }
      });
    });

    return NextResponse.redirect(
      new URL(`/admin/publish?success=Club "${pyramidClub.name}" published.`, request.url),
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
