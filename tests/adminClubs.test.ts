import Database from "better-sqlite3";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { getAdminClubList, getAdminClubDetail, updateAdminClub } from "@/lib/admin/clubs";
import type { AppDatabase } from "@/lib/db/adapter";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn<() => Promise<AppDatabase>>()
}));

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/client")>("@/lib/db/client");
  return { ...actual, getDatabase };
});

afterEach(() => {
  getDatabase.mockReset();
});

function createMinimalDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');

    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES
      (10, 1, 'premier', 'Premier Division', 1, 20),
      (11, 1, 'first', 'First Division', 2, 24);

    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES
      (1, 1, '2024-25'),
      (2, 1, '2025-26');

    INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES
      (10, 2, 1, 10, 'open'),
      (11, 2, 1, 11, 'open'),
      (12, 1, 1, 10, 'open'),
      (13, 1, 1, 11, 'open');

    INSERT INTO pyramid_clubs (id, name, status) VALUES
      (100, 'Test Town United', 'known'),
      (101, 'City Athletic', 'known'),
      (102, 'Rovers FC', 'partial'),
      (103, 'Albion FC', 'known');

    INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
      -- 2025-26: Test Town + City + Albion in Premier; Rovers in First
      (100, 2, 1, 10, 100),
      (101, 2, 1, 10, 101),
      (102, 2, 1, 11, 102),
      (103, 2, 1, 10, 103),
      -- 2024-25: Test Town in First (different division from latest)
      (104, 1, 1, 13, 100);

    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES
      (50, 'Test Park', 'TE1 1ST', 51.5, -0.1),
      (51, 'City Ground', 'CT1 2AB', 52.0, -0.2),
      (52, 'Rovers Stadium', 'RV1 3CD', 53.0, -0.3);

    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
      (100, 100, 50, '2025-08-01', NULL, 1),
      (101, 101, 51, '2025-08-01', NULL, 1),
      (102, 102, 52, '2025-08-01', NULL, 0),
      -- Albion shares Test Park with Test Town
      (103, 103, 50, '2025-08-01', NULL, 1);
  `);

  return db;
}

describe("admin club browser", () => {
  it("lists clubs grouped by division for the latest season", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const result = await getAdminClubList();

    expect(result.season_label).toBe("2025-26");
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

  it("returns null for club not in latest season", async () => {
    const db = createMinimalDb();

    db.exec(`
      INSERT INTO pyramid_clubs (id, name, status) VALUES (200, 'Old Club', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
        (200, 1, 1, 13, 200);
    `);

    getDatabase.mockResolvedValue(db);

    const detail = await getAdminClubDetail(200);

    expect(detail).toBeNull();
  });

  it("returns club detail for latest season membership", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const detail = await getAdminClubDetail(100);

    expect(detail).not.toBeNull();
    expect(detail!.club.name).toBe("Test Town United");
    expect(detail!.season.label).toBe("2025-26");
    expect(detail!.season.division_name).toBe("Premier Division");
    expect(detail!.primaryVenue).not.toBeNull();
    expect(detail!.primaryVenue!.name).toBe("Test Park");
  });

  it("ignores older season memberships for club detail", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const detail = await getAdminClubDetail(100);

    expect(detail).not.toBeNull();
    expect(detail!.season.label).toBe("2025-26");
    expect(detail!.season.division_name).toBe("Premier Division");
    expect(detail!.season.division_level).toBe(1);
  });

  it("warns when a club has no primary venue", async () => {
    const db = createMinimalDb();

    db.exec(`
      INSERT INTO pyramid_clubs (id, name, status) VALUES (300, 'Homeless FC', 'partial');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
        (300, 2, 1, 10, 300);
    `);

    getDatabase.mockResolvedValue(db);

    const detail = await getAdminClubDetail(300);

    expect(detail).not.toBeNull();
    expect(detail!.warnings).toContain("No current primary ground assigned.");
  });

  it("warns when a club shares its primary venue", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const detail = await getAdminClubDetail(103);

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

    getDatabase.mockResolvedValue(db);

    const detail = await getAdminClubDetail(101);

    expect(detail).not.toBeNull();
    expect(detail!.primaryVenue).not.toBeNull();
    expect(detail!.primaryVenue!.name).toBe("City Ground");
  });

  it("returns venue assignment history for a club", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const detail = await getAdminClubDetail(100);

    expect(detail).not.toBeNull();
    expect(detail!.venueAssignments.length).toBeGreaterThanOrEqual(1);
    expect(detail!.venueAssignments[0].venue_name).toBe("Test Park");
    expect(detail!.venueAssignments[0].is_primary).toBe(1);
    expect(detail!.venueAssignments[0].effective_to).toBeNull();
  });

  it("returns null for non-existent club", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    const detail = await getAdminClubDetail(99999);

    expect(detail).toBeNull();
  });
});

describe("updateAdminClub", () => {
  it("updates club fields and stamps admin_updated_at", async () => {
    const db = createMinimalDb();
    getDatabase.mockResolvedValue(db);

    await updateAdminClub(100, {
      name: "Test Town Renamed",
      status: "partial",
      aliases: "TTU, Town"
    });

    const club = await db.get<{ name: string; status: string; aliases: string; admin_updated_at: string | null }>(
      "SELECT name, status, aliases, admin_updated_at FROM pyramid_clubs WHERE id = ?", [100]
    );

    expect(club!.name).toBe("Test Town Renamed");
    expect(club!.status).toBe("partial");
    expect(club!.aliases).toBe("TTU, Town");
    expect(club!.admin_updated_at).not.toBeNull();
  });

  it("writes an audit log entry", async () => {
    const db = createMinimalDb();
    getDatabase.mockResolvedValue(db);

    await updateAdminClub(100, { name: "Renamed Town" });

    const audit = await db.get<{ action: string; entity_type: string; entity_id: string; before_json: string; after_json: string }>(
      "SELECT action, entity_type, entity_id, before_json, after_json FROM admin_audit_log WHERE entity_type = 'pyramid_club' AND action = 'update'"
    );

    expect(audit).not.toBeNull();
    expect(audit!.entity_id).toBe("100");
    expect(JSON.parse(audit!.before_json).name).toBe("Test Town United");
    expect(JSON.parse(audit!.after_json).name).toBe("Renamed Town");
  });

  it("throws for non-existent club", async () => {
    getDatabase.mockResolvedValue(createMinimalDb());

    await expect(updateAdminClub(999, { name: "Ghost" })).rejects.toThrow("Club not found.");
  });

  it("only updates provided fields", async () => {
    const db = createMinimalDb();
    getDatabase.mockResolvedValue(db);

    await updateAdminClub(100, { source_url: "https://example.com" });

    const club = await db.get<{ name: string; status: string; source_url: string | null }>(
      "SELECT name, status, source_url FROM pyramid_clubs WHERE id = ?", [100]
    );

    expect(club!.name).toBe("Test Town United");
    expect(club!.status).toBe("known");
    expect(club!.source_url).toBe("https://example.com");
  });
});
