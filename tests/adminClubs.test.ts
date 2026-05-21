import { describe, expect, it } from "vitest";

import { getAdminClubList, getAdminClubDetail, updateAdminClub } from "@/lib/admin/clubs";
import { createAdminFixtureDatabase } from "./adminFixtures";

function createMinimalDb() {
  return createAdminFixtureDatabase({
    includeAlbionGroundshare: true,
    includePreviousSeason: true
  });
}

describe("admin club browser", () => {
  it("lists clubs grouped by division for the latest season", async () => {
    const db = createMinimalDb();

    const result = await getAdminClubList(db);

    expect(result.seasonLabel).toBe("2025-26");
    expect(result.divisions).toHaveLength(2);

    const premier = result.divisions.find((d) => d.division_name === "Premier Division");
    expect(premier).toBeDefined();
    expect(premier!.clubs).toHaveLength(3);
    expect(premier!.clubs[0].club_name).toBe("Albion FC");
    expect(premier!.clubs[1].club_name).toBe("City Athletic");
    expect(premier!.clubs[2].club_name).toBe("Test Town United");

    const first = result.divisions.find((d) => d.division_name === "First Division");
    expect(first).toBeDefined();
    expect(first!.clubs).toHaveLength(1);
    expect(first!.clubs[0].club_name).toBe("Rovers FC");
  });

  it("returns club detail with unassigned season when club not in latest season", async () => {
    const db = createMinimalDb();

    db.exec(`
      INSERT INTO clubs (id, name) VALUES (200, 'Old Club');
    `);

    const detail = await getAdminClubDetail(db, 200);

    expect(detail).not.toBeNull();
    expect(detail!.club.name).toBe("Old Club");
    expect(detail!.season.label).toBe("Unassigned");
    expect(detail!.season.division_name).toBe("No division");
  });

  it("returns club detail for latest season membership", async () => {
    const db = createMinimalDb();

    const detail = await getAdminClubDetail(db, 100);

    expect(detail).not.toBeNull();
    expect(detail!.club.name).toBe("Test Town United");
    expect(detail!.season.label).toBe("2025-26");
    expect(detail!.season.division_name).toBe("Premier Division");
    expect(detail!.primaryVenue).not.toBeNull();
    expect(detail!.primaryVenue!.name).toBe("Test Park");
  });

  it("ignores older season memberships for club detail", async () => {
    const db = createMinimalDb();

    const detail = await getAdminClubDetail(db, 100);

    expect(detail).not.toBeNull();
    expect(detail!.season.label).toBe("2025-26");
    expect(detail!.season.division_name).toBe("Premier Division");
    expect(detail!.season.division_level).toBe(1);
  });

  it("warns when a club has no primary venue", async () => {
    const db = createMinimalDb();

    db.exec(`
      INSERT INTO clubs (id, name) VALUES (300, 'Homeless FC');
      INSERT INTO division_assignments (club_id, division_id) VALUES (300, 10);
    `);

    const detail = await getAdminClubDetail(db, 300);

    expect(detail).not.toBeNull();
    expect(detail!.warnings).toContain("No current primary ground assigned.");
  });

  it("warns when a club shares its primary venue", async () => {
    const db = createMinimalDb();

    const detail = await getAdminClubDetail(db, 103);

    expect(detail).not.toBeNull();
    expect(detail!.sharingClubs.length).toBeGreaterThan(0);
    expect(detail!.sharingClubs.map((c) => c.name)).toContain("Test Town United");
    expect(detail!.warnings.some((w) => w.includes("Shares primary ground"))).toBe(true);
  });

  it("resolves current primary venue by is_primary=1 and effective_to IS NULL", async () => {
    const db = createMinimalDb();

    db.exec(`
      -- Rovers has a non-primary active assignment and a historically primary one
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
        (104, 101, 52, '2024-08-01', '2025-05-31', 1);
    `);

    const detail = await getAdminClubDetail(db, 101);

    expect(detail).not.toBeNull();
    expect(detail!.primaryVenue).not.toBeNull();
    expect(detail!.primaryVenue!.name).toBe("City Ground");
  });

  it("returns venue assignment history for a club", async () => {
    const db = createMinimalDb();

    const detail = await getAdminClubDetail(db, 100);

    expect(detail).not.toBeNull();
    expect(detail!.venueAssignments.length).toBeGreaterThanOrEqual(1);
    expect(detail!.venueAssignments[0].venue_name).toBe("Test Park");
    expect(detail!.venueAssignments[0].is_primary).toBe(1);
    expect(detail!.venueAssignments[0].effective_to).toBeNull();
  });

  it("returns null for non-existent club", async () => {
    const db = createMinimalDb();

    const detail = await getAdminClubDetail(db, 99999);

    expect(detail).toBeNull();
  });
});

describe("updateAdminClub", () => {
  it("updates club fields and stamps admin_updated_at", async () => {
    const db = createMinimalDb();

    await updateAdminClub(db, 100, {
      name: "Test Town Renamed",
      aliases: "TTU, Town"
    });

    const club = await db.get<{ name: string; aliases: string; admin_updated_at: string | null }>(
      "SELECT name, aliases, admin_updated_at FROM clubs WHERE id = ?", [100]
    );

    expect(club!.name).toBe("Test Town Renamed");
    expect(club!.aliases).toBe("TTU, Town");
    expect(club!.admin_updated_at).not.toBeNull();
  });

  it("writes an audit log entry", async () => {
    const db = createMinimalDb();

    await updateAdminClub(db, 100, { name: "Renamed Town" });

    const audit = await db.get<{ action: string; entity_type: string; entity_id: string; before_json: string; after_json: string }>(
      "SELECT action, entity_type, entity_id, before_json, after_json FROM admin_audit_log WHERE entity_type = 'club' AND action = 'update'"
    );

    expect(audit).not.toBeNull();
    expect(audit!.entity_id).toBe("100");
    expect(JSON.parse(audit!.before_json).name).toBe("Test Town United");
    expect(JSON.parse(audit!.after_json).name).toBe("Renamed Town");
  });

  it("throws for non-existent club", async () => {
    const db = createMinimalDb();

    await expect(updateAdminClub(db, 999, { name: "Ghost" })).rejects.toThrow("Club not found.");
  });

  it("only updates provided fields", async () => {
    const db = createMinimalDb();

    await updateAdminClub(db, 100, { source_url: "https://example.com" });

    const club = await db.get<{ name: string; source_url: string | null }>(
      "SELECT name, source_url FROM clubs WHERE id = ?", [100]
    );

    expect(club!.name).toBe("Test Town United");
    expect(club!.source_url).toBe("https://example.com");
  });
});
