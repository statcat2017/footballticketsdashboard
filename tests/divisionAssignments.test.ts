import Database from "better-sqlite3";

import { describe, expect, it } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import {
  getDivisionAssignments,
  assignClubToDivision,
  unassignClub,
} from "@/lib/admin/divisionAssignments";
import type { AppDatabase } from "@/lib/db/adapter";

function createMinimalDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');

    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES
      (10, 1, 'premier', 'Premier Division', 1, 20),
      (11, 1, 'first', 'First Division', 2, 24),
      (12, 1, 'tier9-div', 'Tier Nine Division', 9, 16),
      (13, 1, 'tier10-div', 'Tier Ten Division', 10, 16);

    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES
      (1, 1, '2025-26');

    INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES
      (10, 1, 1, 10, 'open'),
      (11, 1, 1, 11, 'open');

    INSERT INTO competitions (code, name, tier, kind) VALUES
      ('PL', 'Premier League', 1, 'league');

    INSERT INTO clubs (id, name, status, competition_code) VALUES
      (100, 'Test Town United', 'known', 'PL'),
      (101, 'City Athletic', 'known', 'PL'),
      (102, 'Rovers FC', 'partial', NULL),
      (103, 'Tier Nine Club', 'known', NULL);

    INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
      (100, 1, 1, 10, 100),
      (101, 1, 1, 10, 101),
      (102, 1, 1, 11, 102),
      (103, 1, 1, 12, 103);
  `);

  db.exec("INSERT OR IGNORE INTO division_assignments (club_id, division_id) VALUES (100, 10), (101, 10), (102, 11), (103, 12)");

  db.exec(`
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES
      (50, 'Test Park', 'TE1 1ST', 51.5, -0.1),
      (51, 'City Ground', 'CT1 2AB', 52.0, -0.2);

    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
      (100, 100, 50, '2025-08-01', NULL, 1),
      (101, 101, 51, '2025-08-01', NULL, 1);
  `);

  return db;
}

describe("getDivisionAssignments", () => {
  it("lists all pyramid divisions levels 1-10, including empty divisions", async () => {
    const db = createMinimalDb();

    const data = await getDivisionAssignments(db);

    const levels = data.divisions.map((d) => d.level);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
    expect(levels).toContain(9);
    expect(levels).toContain(10);

    const tier9 = data.divisions.find((d) => d.id === 12);
    expect(tier9).toBeDefined();
    // Division 13 (Tier Ten) has no clubs assigned
    const tier10 = data.divisions.find((d) => d.id === 13);
    expect(tier10).toBeDefined();
    expect(tier10!.clubCount).toBe(0);
  });

  it("shows assigned clubs under their current division", async () => {
    const db = createMinimalDb();

    const data = await getDivisionAssignments(db);

    const premier = data.divisions.find((d) => d.id === 10);
    expect(premier).toBeDefined();
    expect(premier!.clubCount).toBe(2);
    expect(premier!.clubs.map((c) => c.name)).toContain("Test Town United");
    expect(premier!.clubs.map((c) => c.name)).toContain("City Athletic");

    const first = data.divisions.find((d) => d.id === 11);
    expect(first).toBeDefined();
    expect(first!.clubCount).toBe(1);
    expect(first!.clubs[0].name).toBe("Rovers FC");
  });

  it("shows unassigned clubs", async () => {
    const db = createMinimalDb();

    // Only seed backfill should populate assignments. Since the migration
    // runs before our seed inserts pyramid_season_memberships, we manually
    // add a club that has no division_assignments row.
    db.exec("INSERT INTO clubs (id, name, status) VALUES (200, 'Unassigned FC', 'known')");

    const data = await getDivisionAssignments(db);

    const unassignedNames = data.unassignedClubs.map((c) => c.name);
    expect(unassignedNames).toContain("Unassigned FC");
  });
});

describe("assignClubToDivision", () => {
  it("assigns an unassigned club to a division", async () => {
    const db = createMinimalDb();
    db.exec("INSERT INTO clubs (id, name, status) VALUES (200, 'Unassigned FC', 'known')");

    await assignClubToDivision(db, 200, 11, "test-admin");

    const data = await getDivisionAssignments(db);
    const firstDiv = data.divisions.find((d) => d.id === 11);
    expect(firstDiv!.clubs.map((c) => c.name)).toContain("Unassigned FC");

    const unassignedNames = data.unassignedClubs.map((c) => c.name);
    expect(unassignedNames).not.toContain("Unassigned FC");
  });

  it("moves an already-assigned club to a new division", async () => {
    const db = createMinimalDb();

    // Assign Test Town (currently in div 10) to div 11
    await assignClubToDivision(db, 100, 11, "test-admin");

    const data = await getDivisionAssignments(db);
    const premier = data.divisions.find((d) => d.id === 10);
    const first = data.divisions.find((d) => d.id === 11);
    expect(premier!.clubs.map((c) => c.name)).not.toContain("Test Town United");
    expect(first!.clubs.map((c) => c.name)).toContain("Test Town United");
  });

  it("clears clubs.competition_code when assigning", async () => {
    const db = createMinimalDb();
    db.exec("INSERT INTO clubs (id, name, status, competition_code) VALUES (200, 'Reset FC', 'known', 'PL')");

    await assignClubToDivision(db, 200, 11, "test-admin");

    const club = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = ?", [200]
    );
    expect(club!.competition_code).toBeNull();
  });

  it("warns when division is at capacity", async () => {
    const db = createMinimalDb();

    // Division 12 has max_size=16 and currently 0 clubs assigned
    // Create 16 clubs and assign them to fill the division
    for (let i = 200; i < 216; i++) {
      db.exec(`INSERT INTO clubs (id, name, status) VALUES (${i}, 'Fill Club ${i}', 'known')`);
      await assignClubToDivision(db, i, 12, "test-admin");
    }

    // Now try to add one more
    db.exec("INSERT INTO clubs (id, name, status) VALUES (300, 'Overflow FC', 'known')");
    const result = await assignClubToDivision(db, 300, 12, "test-admin");

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("at capacity");

    // Despite the warning, the club should still be assigned
    const data = await getDivisionAssignments(db);
    const tier9 = data.divisions.find((d) => d.id === 12);
    expect(tier9!.clubCount).toBe(18);
  });

  it("throws for non-existent club", async () => {
    const db = createMinimalDb();
    await expect(
      assignClubToDivision(db, 99999, 10, "test-admin")
    ).rejects.toThrow("not found");
  });

  it("throws for non-existent division", async () => {
    const db = createMinimalDb();
    await expect(
      assignClubToDivision(db, 100, 99999, "test-admin")
    ).rejects.toThrow("not found");
  });

  it("writes an audit log entry", async () => {
    const db = createMinimalDb();
    db.exec("INSERT INTO clubs (id, name, status) VALUES (200, 'Audit FC', 'known')");

    await assignClubToDivision(db, 200, 10, "test-admin");

    const audit = await db.get<{ action: string; entity_type: string; entity_id: string; actor: string }>(
      "SELECT action, entity_type, entity_id, actor FROM admin_audit_log WHERE entity_type = 'division_assignment'"
    );
    expect(audit).not.toBeNull();
    expect(audit!.action).toBe("create");
    expect(audit!.entity_id).toBe("200");
  });
});

describe("unassignClub", () => {
  it("removes a club from its division", async () => {
    const db = createMinimalDb();

    await unassignClub(db, 100, "test-admin");

    const data = await getDivisionAssignments(db);
    const premier = data.divisions.find((d) => d.id === 10);
    expect(premier!.clubs.map((c) => c.name)).not.toContain("Test Town United");

    const unassignedNames = data.unassignedClubs.map((c) => c.name);
    expect(unassignedNames).toContain("Test Town United");
  });

  it("clears clubs.competition_code when unassigning", async () => {
    const db = createMinimalDb();

    await unassignClub(db, 100, "test-admin");

    const club = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = ?", [100]
    );
    expect(club!.competition_code).toBeNull();
  });

  it("throws when club is not assigned", async () => {
    const db = createMinimalDb();
    db.exec("INSERT INTO clubs (id, name, status) VALUES (200, 'Lone FC', 'known')");

    await expect(
      unassignClub(db, 200, "test-admin")
    ).rejects.toThrow("not assigned to any division");
  });

  it("writes an audit log entry", async () => {
    const db = createMinimalDb();

    await unassignClub(db, 100, "test-admin");

    const audit = await db.get<{ action: string; entity_type: string; entity_id: string }>(
      "SELECT action, entity_type, entity_id FROM admin_audit_log WHERE entity_type = 'division_assignment' AND action = 'delete'"
    );
    expect(audit).not.toBeNull();
    expect(audit!.entity_id).toBe("100");
  });
});
