import { describe, expect, it } from "vitest";

import type { AppDatabase, SqlWrite } from "@/lib/db/adapter";
import { createAdminFixtureDatabase } from "./adminFixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function seedDb(): AppDatabase {
  return createAdminFixtureDatabase({ includeAlbionGroundshare: true });
}

/**
 * Return a spy that records every call to writeBatch.
 */
function spyOnWriteBatch(db: AppDatabase): { calls: SqlWrite[][]; restore: () => void } {
  const original = db.writeBatch.bind(db);
  const calls: SqlWrite[][] = [];

  const spy: AppDatabase["writeBatch"] = async (statements) => {
    calls.push(statements);
    return original(statements);
  };

  db.writeBatch = spy;
  return {
    calls,
    restore: () => { db.writeBatch = original; },
  };
}

// ---------------------------------------------------------------------------
// Atomicity tests
// ---------------------------------------------------------------------------
describe("data integrity — atomic writes", () => {
  describe("venue create uses writeBatch", () => {
    it("inserts venue and audit log in a single writeBatch call", async () => {
      const db = seedDb();
      const spy = spyOnWriteBatch(db);
      const { createAdminVenue } = await import("@/lib/admin/venues");

      const venueId = await createAdminVenue(db, {
        name: "Atomic Stadium",
        postcode: "AT1 1OM",
        latitude: 51.5,
        longitude: -0.1,
      });

      expect(spy.calls).toHaveLength(1);
      expect(spy.calls[0]).toHaveLength(2);
      expect(spy.calls[0][0].sql).toContain("INSERT INTO venues");
      expect(spy.calls[0][1].sql).toContain("INSERT INTO admin_audit_log");

      const venue = await db.get<{ id: number }>(
        "SELECT id FROM venues WHERE id = ?", [venueId]
      );
      expect(venue).not.toBeNull();

      const audit = await db.get<{ entity_type: string; action: string }>(
        "SELECT entity_type, action FROM admin_audit_log WHERE entity_type = 'venue'"
      );
      expect(audit).not.toBeNull();
      expect(audit!.action).toBe("create");
    });
  });

  describe("club update uses writeBatch", () => {
    it("updates club and writes audit log in a single writeBatch call", async () => {
      const db = seedDb();
      const spy = spyOnWriteBatch(db);
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await updateAdminClub(db, 100, { name: "Atomic Town" });

      expect(spy.calls).toHaveLength(1);
      expect(spy.calls[0]).toHaveLength(2);
      expect(spy.calls[0][0].sql).toContain("UPDATE clubs");
      expect(spy.calls[0][1].sql).toContain("INSERT INTO admin_audit_log");

      const club = await db.get<{ name: string }>(
        "SELECT name FROM clubs WHERE id = 100"
      );
      expect(club!.name).toBe("Atomic Town");
    });
  });

  describe("assign venue includes audit log in writeBatch", () => {
    it("includes audit log inside writeBatch, not as a separate call", async () => {
      const db = seedDb();
      const spy = spyOnWriteBatch(db);
      const { assignAdminVenue } = await import("@/lib/admin/venues");

      await assignAdminVenue(db, 100, 51, "2026-07-01");

      expect(spy.calls).toHaveLength(1);

      const auditStmt = spy.calls[0].find((s) => s.sql.includes("admin_audit_log"));
      expect(auditStmt).toBeDefined();
      expect(auditStmt!.sql).toContain("INSERT INTO admin_audit_log");

      const audit = await db.get<{ entity_type: string; action: string }>(
        "SELECT entity_type, action FROM admin_audit_log"
      );
      expect(audit).not.toBeNull();
      expect(audit!.entity_type).toBe("club_venue_assignment");
    });
  });

  describe("alias operations use transaction", () => {
    it("handleRetire wraps retireAlias + audit log in db.transaction", async () => {
      const db = seedDb();
      const { addAlias } = await import("@/lib/db/clubMapping");

      const created = await addAlias(db, 100, "Retire Test Alias");
      const aliasId = created.id;

      let txRan = false;
      const originalTx = db.transaction.bind(db);
      db.transaction = (async (fn: (txDb: AppDatabase) => Promise<unknown>) => {
        txRan = true;
        return originalTx(fn);
      }) as AppDatabase["transaction"];

      const { retireAlias } = await import("@/lib/db/clubMapping");
      const { writeAdminAuditLog } = await import("@/lib/admin/audit");
      await db.transaction(async (txDb) => {
        await retireAlias(txDb, aliasId, 100);
        await writeAdminAuditLog(txDb, {
          action: "update",
          entityType: "club_alias",
          entityId: aliasId,
          before: { aliasId, clubId: 100 },
          after: { aliasId, clubId: 100, retired: true },
        });
      });

      expect(txRan).toBe(true);

      const retired = await db.get<{ retired_at: string | null }>(
        "SELECT retired_at FROM club_aliases WHERE id = ?", [aliasId]
      );
      expect(retired!.retired_at).not.toBeNull();

      const audit = await db.get<{ action: string }>(
        "SELECT action FROM admin_audit_log WHERE entity_id = ?", [String(aliasId)]
      );
      expect(audit).not.toBeNull();
      expect(audit!.action).toBe("update");

      db.transaction = originalTx;
    });
  });

  describe("venue delete includes UPDATE in writeBatch", () => {
    it("UPDATE import_batch_rows is part of writeBatch, not separate", async () => {
      const db = seedDb();

      db.exec(`
        INSERT INTO fixture_sources (id, source_type, name, trust_level) VALUES (1, 'csv_paste', 'Test', 'untrusted');
        INSERT INTO import_batches (id, source_id, adapter_type, actor) VALUES (1, 1, 'csv_paste', 'test');
        INSERT INTO import_batch_rows (id, batch_id, row_index, home_participant_raw, away_participant_raw, venue_resolved_id) VALUES
          (1, 1, 0, 'Home', 'Away', 50);
      `);

      const { buildAdminAuditLogWrite } = await import("@/lib/admin/audit");

      const batch: SqlWrite[] = [
        { sql: "UPDATE import_batch_rows SET venue_resolved_id = NULL WHERE venue_resolved_id = ?", params: [50] },
        { sql: "DELETE FROM venues WHERE id = ?", params: [50] },
        buildAdminAuditLogWrite({ action: "delete", entityType: "venue", entityId: 50, before: { name: "Test Park" } }),
      ];

      await db.writeBatch(batch);

      const row = await db.get<{ venue_resolved_id: number | null }>(
        "SELECT venue_resolved_id FROM import_batch_rows WHERE id = 1"
      );
      expect(row!.venue_resolved_id).toBeNull();

      const venue = await db.get("SELECT id FROM venues WHERE id = 50");
      expect(venue).toBeUndefined();

      const audit = await db.get<{ action: string; entity_id: string }>(
        "SELECT action, entity_id FROM admin_audit_log WHERE entity_type = 'venue'"
      );
      expect(audit).not.toBeNull();
      expect(audit!.entity_id).toBe("50");
    });
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("data integrity — input validation", () => {
  describe("venue postcode validation", () => {
    it("rejects postcode with only letters", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        createAdminVenue(db, { name: "Bad", postcode: "ABCDEF", latitude: 51, longitude: 0 })
      ).rejects.toThrow("Invalid postcode format.");
    });

    it("rejects postcode with only numbers", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        createAdminVenue(db, { name: "Bad", postcode: "12345", latitude: 51, longitude: 0 })
      ).rejects.toThrow("Invalid postcode format.");
    });

    it("accepts valid-looking UK postcode", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      const id = await createAdminVenue(db, { name: "Good", postcode: "SW1A 1AA", latitude: 51.5, longitude: -0.1 });
      expect(id).toBeGreaterThan(0);
    });

    it("rejects empty postcode", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        createAdminVenue(db, { name: "Bad", postcode: "", latitude: 51, longitude: 0 })
      ).rejects.toThrow("Invalid postcode format.");
    });
  });

  describe("venue update postcode validation", () => {
    it("rejects invalid postcode on update", async () => {
      const db = seedDb();
      const { updateAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        updateAdminVenue(db, 50, { postcode: "BAD" }, true)
      ).rejects.toThrow("Invalid postcode format.");
    });

    it("accepts valid postcode on update", async () => {
      const db = seedDb();
      const { updateAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        updateAdminVenue(db, 50, { postcode: "TE2 2ND" }, true)
      ).resolves.not.toThrow();
    });
  });

  describe("venue name length validation", () => {
    it("rejects venue name over 200 characters", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        createAdminVenue(db, {
          name: "X".repeat(201),
          postcode: "SW1A 1AA",
          latitude: 51.5,
          longitude: -0.1,
        })
      ).rejects.toThrow("200 characters or fewer");
    });
  });

  describe("duplicate venue detection", () => {
    it("rejects venue with same name and postcode", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      await expect(
        createAdminVenue(db, { name: "Test Park", postcode: "TE1 1ST", latitude: 51.5, longitude: -0.1 })
      ).rejects.toThrow("already exists");
    });

    it("allows same name with different postcode", async () => {
      const db = seedDb();
      const { createAdminVenue } = await import("@/lib/admin/venues");

      const id = await createAdminVenue(db, { name: "Test Park", postcode: "NW1 4SA", latitude: 51.5, longitude: -0.1 });
      expect(id).toBeGreaterThan(0);
    });
  });

  describe("club source_url validation", () => {
    it("rejects missing protocol", async () => {
      const db = seedDb();
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await expect(
        updateAdminClub(db, 100, { source_url: "example.com/page" })
      ).rejects.toThrow("Invalid source URL.");
    });

    it("rejects javascript: URL", async () => {
      const db = seedDb();
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await expect(
        updateAdminClub(db, 100, { source_url: "javascript:alert(1)" })
      ).rejects.toThrow("Invalid source URL.");
    });

    it("accepts https:// URL", async () => {
      const db = seedDb();
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await expect(
        updateAdminClub(db, 100, { source_url: "https://example.com/club" })
      ).resolves.not.toThrow();
    });

    it("accepts null to clear the field", async () => {
      const db = seedDb();
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await expect(
        updateAdminClub(db, 100, { source_url: null })
      ).resolves.not.toThrow();
    });
  });

  describe("club name length validation", () => {
    it("rejects club name over 200 characters", async () => {
      const db = seedDb();
      const { updateAdminClub } = await import("@/lib/admin/clubs");

      await expect(
        updateAdminClub(db, 100, { name: "X".repeat(201) })
      ).rejects.toThrow("200 characters or fewer");
    });
  });

  describe("alias length validation", () => {
    it("rejects alias over 200 characters", async () => {
      const db = seedDb();
      const { addAlias } = await import("@/lib/db/clubMapping");

      await expect(
        addAlias(db, 100, "X".repeat(201))
      ).rejects.toThrow("200 characters or fewer");
    });
  });
});
