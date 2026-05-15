import Database from "better-sqlite3";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import {
  getAdminVenueList,
  getAdminVenue,
  createAdminVenue,
  updateAdminVenue,
  assignAdminVenue
} from "@/lib/admin/venues";
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
      (1, 1, '2025-26');

    INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES
      (10, 1, 1, 10, 'open'),
      (11, 1, 1, 11, 'open');

    INSERT INTO pyramid_clubs (id, name, status) VALUES
      (100, 'Test Town United', 'known'),
      (101, 'City Athletic', 'known'),
      (102, 'Rovers FC', 'partial');

    INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
      (100, 1, 1, 10, 100),
      (101, 1, 1, 10, 101),
      (102, 1, 1, 11, 102);

    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES
      (50, 'Test Park', 'TE1 1ST', 51.5, -0.1),
      (51, 'City Ground', 'CT1 2AB', 52.0, -0.2),
      (52, 'Rovers Stadium', 'RV1 3CD', 53.0, -0.3);

    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
      (100, 100, 50, '2025-08-01', NULL, 1),
      (101, 101, 51, '2025-08-01', NULL, 1),
      -- Rovers: non-primary assignment only
      (102, 102, 52, '2025-08-01', NULL, 0);
  `);

  return db;
}

describe("admin venue service", () => {
  describe("getAdminVenueList", () => {
    it("returns all venues with current club counts", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      const venues = await getAdminVenueList();

      expect(venues).toHaveLength(3);
      const park = venues.find((v) => v.id === 50)!;
      expect(park.current_club_count).toBe(1);
      expect(park.name).toBe("Test Park");

      const city = venues.find((v) => v.id === 51)!;
      expect(city.current_club_count).toBe(1);

      const rovers = venues.find((v) => v.id === 52)!;
      expect(rovers.current_club_count).toBe(0);
    });

    it("counts only current primary assignments", async () => {
      const db = createMinimalDb();

      db.exec(`
        INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
          (103, 100, 51, '2024-08-01', '2025-05-31', 1);
      `);

      getDatabase.mockResolvedValue(db);

      const venues = await getAdminVenueList();
      const city = venues.find((v) => v.id === 51)!;

      expect(city.current_club_count).toBe(1);
    });
  });

  describe("getAdminVenue", () => {
    it("returns venue detail with sharing clubs", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      const data = await getAdminVenue(50);

      expect(data).not.toBeNull();
      expect(data!.venue.name).toBe("Test Park");
      expect(data!.venue.postcode).toBe("TE1 1ST");
      expect(data!.sharingClubs).toHaveLength(1);
      expect(data!.sharingClubs[0].name).toBe("Test Town United");
    });

    it("returns null for non-existent venue", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      const data = await getAdminVenue(999);

      expect(data).toBeNull();
    });

    it("returns empty sharing clubs for unused venue", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      const data = await getAdminVenue(52);

      expect(data).not.toBeNull();
      expect(data!.sharingClubs).toHaveLength(0);
    });
  });

  describe("createAdminVenue", () => {
    it("creates a venue and returns its ID", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      const venueId = await createAdminVenue({
        name: "New Stadium",
        postcode: "NW1 4SA",
        latitude: 51.5,
        longitude: -0.2
      });

      expect(venueId).toBeGreaterThan(0);

      const venue = await db.get<{ name: string }>("SELECT name FROM venues WHERE id = ?", [venueId]);
      expect(venue!.name).toBe("New Stadium");
    });

    it("writes an audit log entry", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      const venueId = await createAdminVenue({
        name: "Audit Arena",
        postcode: "A1 1AA",
        latitude: 51.0,
        longitude: 0.0
      });

      const audit = await db.get<{ action: string; entity_type: string; entity_id: string; after_json: string }>(
        "SELECT action, entity_type, entity_id, after_json FROM admin_audit_log WHERE entity_type = 'venue'"
      );

      expect(audit).not.toBeNull();
      expect(audit!.action).toBe("create");
      expect(audit!.entity_id).toBe(String(venueId));
    });

    it("accepts is_approximate flag", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      await createAdminVenue({
        name: "Approx Ground",
        postcode: "AP1 1PR",
        latitude: 51.4,
        longitude: -0.1,
        is_approximate: 1
      });

      const venue = await db.get<{ is_approximate: number }>(
        "SELECT is_approximate FROM venues WHERE name = ?", ["Approx Ground"]
      );
      expect(venue!.is_approximate).toBe(1);
    });
  });

  describe("updateAdminVenue", () => {
    it("updates venue fields and stamps admin_updated_at", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      await updateAdminVenue(50, { name: "Test Park Renamed", postcode: "TE2 2ND" }, true);

      const venue = await db.get<{ name: string; postcode: string; admin_updated_at: string | null }>(
        "SELECT name, postcode, admin_updated_at FROM venues WHERE id = ?", [50]
      );

      expect(venue!.name).toBe("Test Park Renamed");
      expect(venue!.postcode).toBe("TE2 2ND");
      expect(venue!.admin_updated_at).not.toBeNull();
    });

    it("writes an audit log entry", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      await updateAdminVenue(50, { name: "Renamed Park" }, true);

      const audit = await db.get<{ action: string; before_json: string; after_json: string }>(
        "SELECT action, before_json, after_json FROM admin_audit_log WHERE entity_type = 'venue' AND action = 'update'"
      );

      expect(audit).not.toBeNull();
      expect(audit!.action).toBe("update");
    });

    it("throws when updating shared venue without confirmation", async () => {
      const db = createMinimalDb();

      db.exec(`
        INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
          (103, 102, 50, '2026-08-01', NULL, 1);
      `);

      getDatabase.mockResolvedValue(db);

      await expect(
        updateAdminVenue(50, { name: "Shared Park" }, false)
      ).rejects.toThrow("Confirmation required");
    });

    it("succeeds when updating shared venue with confirmation", async () => {
      const db = createMinimalDb();

      db.exec(`
        INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
          (103, 102, 50, '2026-08-01', NULL, 1);
      `);

      getDatabase.mockResolvedValue(db);

      await expect(
        updateAdminVenue(50, { name: "Shared Park" }, true)
      ).resolves.not.toThrow();
    });

    it("can clear is_approximate from 1 to 0", async () => {
      const db = createMinimalDb();

      db.exec(`
        UPDATE venues SET is_approximate = 1 WHERE id = 50;
      `);

      getDatabase.mockResolvedValue(db);

      await updateAdminVenue(50, { is_approximate: 0 }, true);

      const venue = await db.get<{ is_approximate: number }>(
        "SELECT is_approximate FROM venues WHERE id = ?", [50]
      );
      expect(venue!.is_approximate).toBe(0);
    });

    it("rejects invalid NaN latitude at service layer", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        updateAdminVenue(50, { latitude: NaN }, true)
      ).rejects.toThrow("Invalid latitude.");
    });

    it("rejects latitude outside -90..90 range at service layer", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        updateAdminVenue(50, { latitude: 100 }, true)
      ).rejects.toThrow("Invalid latitude.");
    });

    it("rejects longitude outside -180..180 range at service layer", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        updateAdminVenue(50, { longitude: 200 }, true)
      ).rejects.toThrow("Invalid longitude.");
    });
  });

  describe("assignAdminVenue", () => {
    it("ends current primary and creates new assignment", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      await assignAdminVenue(100, 51, "2026-07-01");

      const oldAssignment = await db.get<{ effective_to: string | null }>(
        "SELECT effective_to FROM club_venue_assignments WHERE id = 100"
      );
      expect(oldAssignment!.effective_to).toBe("2026-06-30");

      const newAssignment = await db.get<{ venue_id: number; effective_from: string; is_primary: number; effective_to: string | null }>(
        "SELECT venue_id, effective_from, is_primary, effective_to FROM club_venue_assignments WHERE club_id = 100 AND id != 100"
      );
      expect(newAssignment).not.toBeNull();
      expect(newAssignment!.venue_id).toBe(51);
      expect(newAssignment!.effective_from).toBe("2026-07-01");
      expect(newAssignment!.is_primary).toBe(1);
      expect(newAssignment!.effective_to).toBeNull();
    });

    it("creates first assignment when no current primary exists", async () => {
      const db = createMinimalDb();

      db.exec(`
        INSERT INTO pyramid_clubs (id, name, status) VALUES (200, 'New Club', 'known');
        INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
          (200, 1, 1, 10, 200);
      `);

      getDatabase.mockResolvedValue(db);

      await assignAdminVenue(200, 50, "2026-07-01");

      const assignment = await db.get<{ venue_id: number; effective_from: string }>(
        "SELECT venue_id, effective_from FROM club_venue_assignments WHERE club_id = 200"
      );
      expect(assignment).not.toBeNull();
      expect(assignment!.venue_id).toBe(50);
    });

    it("writes an audit log entry", async () => {
      const db = createMinimalDb();
      getDatabase.mockResolvedValue(db);

      await assignAdminVenue(100, 51, "2026-07-01");

      const audit = await db.get<{ action: string; entity_type: string; entity_id: string }>(
        "SELECT action, entity_type, entity_id FROM admin_audit_log WHERE entity_type = 'club_venue_assignment'"
      );

      expect(audit).not.toBeNull();
      expect(audit!.entity_id).toBe("100");
    });

    it("rejects invalid real-world date like 2026-02-31", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(100, 51, "2026-02-31")
      ).rejects.toThrow("Invalid effective_from date.");
    });

    it("rejects effective date before current assignment start", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(100, 51, "2025-06-01")
      ).rejects.toThrow("Effective date must be after the current assignment start date.");
    });

    it("rejects effective date equal to current assignment start", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(100, 51, "2025-08-01")
      ).rejects.toThrow("Effective date must be after the current assignment start date.");
    });

    it("rejects unknown club with controlled error", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(99999, 51, "2026-07-01")
      ).rejects.toThrow("Club not found.");
    });

    it("rejects unknown venue with controlled error", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(100, 99999, "2026-07-01")
      ).rejects.toThrow("Venue not found.");
    });

    it("rejects assigning the same venue club already uses", async () => {
      getDatabase.mockResolvedValue(createMinimalDb());

      await expect(
        assignAdminVenue(100, 50, "2026-07-01")
      ).rejects.toThrow("Club is already assigned to this venue.");
    });
  });
});
