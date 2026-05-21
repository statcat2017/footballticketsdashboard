import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import {
  getMovementViewData,
  createSlots,
  fillSlot,
  unfillSlot,
  deleteSlot,
  applyAllFilledSlots,
  validateSlotFill,
  getDivisionsInTierRange,
  getClubsInDivision,
  getConnectedTargets,
} from "@/lib/admin/movements";

function createMinimalDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');

    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size, display_order) VALUES
      (1, 1, 'premier-league', 'Premier League', 1, 20, 1),
      (2, 1, 'championship', 'Championship', 2, 24, 2),
      (3, 1, 'league-one', 'League One', 3, 24, 3),
      (4, 1, 'league-two', 'League Two', 4, 24, 4),
      (5, 1, 'national-league', 'National League', 5, 24, 5),
      (6, 1, 'national-league-north', 'National League North', 6, 24, 6),
      (7, 1, 'national-league-south', 'National League South', 6, 24, 7),
      (10, 1, 'tier10-div-a', 'Tier 10 Division A', 10, 16, 20);

    INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type) VALUES
      (1, 2, 1, 'promotion'),
      (2, 1, 2, 'relegation'),
      (3, 3, 2, 'promotion'),
      (4, 2, 3, 'relegation');

    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES
      (1, 1, '2025-26');

    INSERT INTO competitions (code, name, tier, kind) VALUES
      ('PL', 'Premier League', 1, 'league'),
      ('CH', 'Championship', 2, 'league');

    INSERT INTO clubs (id, name) VALUES
      (100, 'Test Town United'),
      (101, 'City Athletic'),
      (102, 'Rovers FC'),
      (103, 'County Town'),
      (104, 'Athletic FC');

    INSERT INTO division_assignments (club_id, division_id) VALUES
      (100, 1), (101, 1),
      (102, 2), (103, 2),
      (104, 10);
  `);

  return db;
}

describe("getDivisionsInTierRange", () => {
  it("returns divisions within the tier range", async () => {
    const db = createMinimalDb();
    const divs = await getDivisionsInTierRange(db, 1, 2);
    expect(divs).toHaveLength(2);
    expect(divs.map((d) => d.name)).toContain("Premier League");
    expect(divs.map((d) => d.name)).toContain("Championship");
  });

  it("returns empty array for out-of-range tiers", async () => {
    const db = createMinimalDb();
    const divs = await getDivisionsInTierRange(db, 99, 100);
    expect(divs).toHaveLength(0);
  });
});

describe("getClubsInDivision", () => {
  it("returns clubs assigned to a division", async () => {
    const db = createMinimalDb();
    const clubs = await getClubsInDivision(db, 1);
    expect(clubs).toHaveLength(2);
    expect(clubs.map((c) => c.name)).toContain("Test Town United");
    expect(clubs.map((c) => c.name)).toContain("City Athletic");
  });

  it("returns empty array for empty division", async () => {
    const db = createMinimalDb();
    const clubs = await getClubsInDivision(db, 3);
    expect(clubs).toHaveLength(0);
  });
});

describe("getConnectedTargets", () => {
  it("returns promotion targets for a division", async () => {
    const db = createMinimalDb();
    const targets = await getConnectedTargets(db, 2, "promotion");
    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("Premier League");
  });

  it("returns relegation targets for a division", async () => {
    const db = createMinimalDb();
    const targets = await getConnectedTargets(db, 1, "relegation");
    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("Championship");
  });

  it("returns empty array when no edges exist", async () => {
    const db = createMinimalDb();
    const targets = await getConnectedTargets(db, 10, "promotion");
    expect(targets).toHaveLength(0);
  });
});

describe("createSlots", () => {
  it("creates N slots with correct indices", async () => {
    const db = createMinimalDb();
    const result = await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    expect(result.created).toBe(3);
    expect(result.skipped).toBe(0);

    const rows = await db.all<{ slot_index: number; club_id: number | null }>(
      "SELECT slot_index, club_id FROM movement_slots WHERE source_division_id = 2 AND target_division_id = 1 AND movement_type = 'promotion' ORDER BY slot_index"
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].slot_index).toBe(0);
    expect(rows[1].slot_index).toBe(1);
    expect(rows[2].slot_index).toBe(2);
    expect(rows.every((r) => r.club_id === null)).toBe(true);
  });

  it("is idempotent — skips existing slots on re-run", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");
    const result = await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(3);

    const count = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM movement_slots WHERE source_division_id = 2 AND target_division_id = 1 AND movement_type = 'promotion'"
    );
    expect(count!.count).toBe(3);
  });

  it("creates additional slots when count increases", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 2, "test-admin");
    const result = await createSlots(db, 2, 1, "promotion", 4, "test-admin");

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(2);

    const count = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM movement_slots WHERE source_division_id = 2 AND target_division_id = 1 AND movement_type = 'promotion'"
    );
    expect(count!.count).toBe(4);
  });

  it("throws for non-existent source division", async () => {
    const db = createMinimalDb();
    await expect(
      createSlots(db, 999, 1, "promotion", 1, "test-admin")
    ).rejects.toThrow("not found");
  });

  it("throws for non-existent target division", async () => {
    const db = createMinimalDb();
    await expect(
      createSlots(db, 1, 999, "relegation", 1, "test-admin")
    ).rejects.toThrow("not found");
  });

  it("throws when source equals target", async () => {
    const db = createMinimalDb();
    await expect(
      createSlots(db, 1, 1, "migration", 1, "test-admin")
    ).rejects.toThrow("must be different");
  });
});

describe("fillSlot", () => {
  it("fills an unfilled slot with a club in the source division", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    const slots = await db.all<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    const result = await fillSlot(db, slots[0].id, 102, "test-admin");

    expect(result.warnings).toEqual([]);

    const row = await db.get<{ club_id: number; actor: string }>(
      "SELECT club_id, actor FROM movement_slots WHERE id = ?",
      [slots[0].id]
    );
    expect(row!.club_id).toBe(102);
    expect(row!.actor).toBe("test-admin");
  });

  it("rejects if slot is already filled", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    const slots = await db.all<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slots[0].id, 102, "test-admin");

    await expect(
      fillSlot(db, slots[0].id, 103, "test-admin")
    ).rejects.toThrow("already filled");
  });

  it("rejects if club is not in source division", async () => {
    const db = createMinimalDb();
    await createSlots(db, 1, 2, "relegation", 3, "test-admin");

    const slots = await db.all<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 1 AND slot_index = 0"
    );

    await expect(
      fillSlot(db, slots[0].id, 102, "test-admin")
    ).rejects.toThrow("not assigned to the source division");
  });

  it("rejects if club is already in another filled slot", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    const slots = await db.all<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 ORDER BY slot_index"
    );
    await fillSlot(db, slots[0].id, 102, "test-admin");

    await expect(
      fillSlot(db, slots[1].id, 102, "test-admin")
    ).rejects.toThrow("already assigned to another filled slot");
  });

  it("warns when no pyramid edge exists", async () => {
    const db = createMinimalDb();
    await createSlots(db, 10, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 10 AND slot_index = 0"
    );

    const result = await fillSlot(db, slot!.id, 104, "test-admin");
    expect(result.warnings).toContain("No pyramid edge exists between these divisions.");
  });

  it("writes audit log entry", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );

    await fillSlot(db, slot!.id, 102, "test-admin");

    const audit = await db.get<{ action: string; entity_type: string; entity_id: string }>(
      "SELECT action, entity_type, entity_id FROM admin_audit_log WHERE action = 'movement_slot_fill'"
    );
    expect(audit).not.toBeNull();
    expect(audit!.action).toBe("movement_slot_fill");
    expect(audit!.entity_id).toBe(String(slot!.id));
  });
});

describe("validateSlotFill", () => {
  it("returns no errors for a valid fill", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );

    const result = await validateSlotFill(db, slot!.id, 102);
    expect(result.errors).toEqual([]);
  });

  it("returns error for slot not found", async () => {
    const db = createMinimalDb();
    const result = await validateSlotFill(db, 9999, 102);
    expect(result.errors).toContain("Slot not found.");
  });

  it("returns error for already filled slot", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slot!.id, 102, "test-admin");

    const result = await validateSlotFill(db, slot!.id, 103);
    expect(result.errors).toContain("Slot is already filled.");
  });

  it("returns error for club not in source", async () => {
    const db = createMinimalDb();
    await createSlots(db, 1, 2, "relegation", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 1 AND slot_index = 0"
    );

    const result = await validateSlotFill(db, slot!.id, 102);
    expect(result.errors).toContain("Club is not assigned to the source division for this slot.");
  });
});

describe("unfillSlot", () => {
  it("clears a filled slot", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slot!.id, 102, "test-admin");
    await unfillSlot(db, slot!.id, "test-admin");

    const row = await db.get<{ club_id: number | null }>(
      "SELECT club_id FROM movement_slots WHERE id = ?",
      [slot!.id]
    );
    expect(row!.club_id).toBeNull();
  });

  it("rejects if slot is not filled", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );

    await expect(
      unfillSlot(db, slot!.id, "test-admin")
    ).rejects.toThrow("not filled");
  });

  it("writes audit log entry", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slot!.id, 102, "test-admin");
    await unfillSlot(db, slot!.id, "test-admin");

    const audit = await db.get<{ action: string }>(
      "SELECT action FROM admin_audit_log WHERE action = 'movement_slot_unfill'"
    );
    expect(audit).not.toBeNull();
  });
});

describe("deleteSlot", () => {
  it("deletes an unfilled slot", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await deleteSlot(db, slot!.id, "test-admin");

    const row = await db.get(
      "SELECT id FROM movement_slots WHERE id = ?",
      [slot!.id]
    );
    expect(row).toBeUndefined();
  });

  it("rejects deleting a filled slot", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slot!.id, 102, "test-admin");

    await expect(
      deleteSlot(db, slot!.id, "test-admin")
    ).rejects.toThrow("Cannot delete a filled slot");
  });

  it("rejects for non-existent slot", async () => {
    const db = createMinimalDb();
    await expect(
      deleteSlot(db, 9999, "test-admin")
    ).rejects.toThrow("not found");
  });
});

describe("applyAllFilledSlots", () => {
  it("moves all filled clubs to target divisions and clears slots", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 2, "test-admin");

    const slots = await db.all<{ id: number; slot_index: number }>(
      "SELECT id, slot_index FROM movement_slots WHERE source_division_id = 2 ORDER BY slot_index"
    );
    await fillSlot(db, slots[0].id, 102, "test-admin");
    await fillSlot(db, slots[1].id, 103, "test-admin");

    const applied = await applyAllFilledSlots(db, "test-admin");

    expect(applied).toBe(2);

    const club102 = await db.get<{ division_id: number }>(
      "SELECT division_id FROM division_assignments WHERE club_id = 102"
    );
    expect(club102!.division_id).toBe(1);

    const club103 = await db.get<{ division_id: number }>(
      "SELECT division_id FROM division_assignments WHERE club_id = 103"
    );
    expect(club103!.division_id).toBe(1);

    const remaining = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM movement_slots WHERE club_id IS NOT NULL"
    );
    expect(remaining!.count).toBe(0);
  });

  it("returns 0 when no filled slots exist", async () => {
    const db = createMinimalDb();
    const applied = await applyAllFilledSlots(db, "test-admin");
    expect(applied).toBe(0);
  });

  it("clears all slots after applying, including unfilled", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    const slots = await db.all<{ id: number; slot_index: number }>(
      "SELECT id, slot_index FROM movement_slots WHERE source_division_id = 2 ORDER BY slot_index"
    );
    await fillSlot(db, slots[0].id, 102, "test-admin");

    const applied = await applyAllFilledSlots(db, "test-admin");
    expect(applied).toBe(1);

    const remaining = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM movement_slots"
    );
    expect(remaining!.count).toBe(0);
  });

  it("writes audit log entries", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");

    const slot = await db.get<{ id: number }>(
      "SELECT id FROM movement_slots WHERE source_division_id = 2 AND slot_index = 0"
    );
    await fillSlot(db, slot!.id, 102, "test-admin");
    await applyAllFilledSlots(db, "test-admin");

    const audit = await db.get<{ action: string; entity_type: string }>(
      "SELECT action, entity_type FROM admin_audit_log WHERE action = 'movement_slot_apply'"
    );
    expect(audit).not.toBeNull();
    expect(audit!.entity_type).toBe("club_movement");
  });
});

describe("getMovementViewData", () => {
  it("returns empty view when no slots exist", async () => {
    const db = createMinimalDb();
    const view = await getMovementViewData(db, 1, 5);
    expect(view.totalSlots).toBe(0);
    expect(view.totalFilled).toBe(0);
    expect(view.affectedDivisions).toBe(0);
    expect(view.slotGroups).toHaveLength(0);
  });

  it("groups slots by source/target/type correctly", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");
    await createSlots(db, 1, 2, "relegation", 3, "test-admin");

    const view = await getMovementViewData(db, 1, 5);
    expect(view.totalSlots).toBe(6);
    expect(view.slotGroups).toHaveLength(2);

    const promoteGroup = view.slotGroups.find(
      (g) => g.movementType === "promotion" && g.sourceDivisionName === "Championship"
    );
    expect(promoteGroup).toBeDefined();
    expect(promoteGroup!.totalSlots).toBe(3);
    expect(promoteGroup!.targetDivisionName).toBe("Premier League");
  });

  it("counts filled slots correctly", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 3, "test-admin");

    const slots = await db.all<{ id: number; slot_index: number }>(
      "SELECT id, slot_index FROM movement_slots WHERE source_division_id = 2 ORDER BY slot_index"
    );
    await fillSlot(db, slots[0].id, 102, "test-admin");

    const view = await getMovementViewData(db, 1, 5);
    expect(view.totalFilled).toBe(1);

    const group = view.slotGroups[0];
    expect(group.filledSlots).toBe(1);
    expect(group.slots[0].clubName).toBe("Rovers FC");
    expect(group.slots[1].clubName).toBeNull();
  });

  it("filters by tier range", async () => {
    const db = createMinimalDb();
    await createSlots(db, 2, 1, "promotion", 1, "test-admin");
    await createSlots(db, 10, 1, "promotion", 1, "test-admin");

    const viewHigh = await getMovementViewData(db, 1, 5);
    expect(viewHigh.slotGroups).toHaveLength(1);

    const viewAll = await getMovementViewData(db, 1, 10);
    expect(viewAll.slotGroups).toHaveLength(2);
  });
});
