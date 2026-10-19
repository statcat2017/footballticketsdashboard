import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { openDatabase, setupDatabase } from "@/lib/db/setup";
import { SEED_DATA } from "@/lib/db/seed-data";
import {
  MEN_PYRAMID_CLUBS,
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES
} from "@/lib/db/pyramid";

const totalClubs = (() => {
  const seedNames = new Set(SEED_DATA.clubs.map((c) => c.name));
  return SEED_DATA.clubs.length + MEN_PYRAMID_CLUBS.filter((pc) => !seedNames.has(pc.name)).length;
})();

describe("database setup", () => {
  it("preserves operational edits when initialization is repeated", async () => {
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-db-preserve-"));
    const filename = path.join(dirname, "nearmefc.sqlite");
    const first = await setupDatabase(filename);
    const club = SEED_DATA.clubs[0];
    const venue = SEED_DATA.venues.find((row) => row.id === club.venue_id)!;
    const fixture = SEED_DATA.fixtures[0];
    const fixtureId = first.prepare("SELECT id FROM fixtures WHERE source = ? AND source_id = ?").get(fixture.source, fixture.source_id) as { id: number };
    const divisionAssignment = first.prepare("SELECT club_id, division_id FROM division_assignments WHERE club_id = ?").get(club.id) as { club_id: number; division_id: number };
    const venueAssignment = first.prepare("SELECT id FROM club_venue_assignments ORDER BY id LIMIT 1").get() as { id: number };

    first.prepare("UPDATE venues SET name = ? WHERE id = ?").run("Operator venue name", venue.id);
    first.prepare("UPDATE clubs SET name = ?, short_name = ? WHERE id = ?").run("Operator club name", "Edited", club.id);
    first.prepare("UPDATE club_ticket_prices SET adult_price_pence = ?, source_url = ? WHERE club_id = ?").run(4321, "https://example.com/price", club.id);
    first.prepare("INSERT INTO fixture_ticket_price_overrides (fixture_id, adult_price_pence, source_url, confidence) VALUES (?, ?, ?, 'verified')").run(fixtureId.id, 7654, "https://example.com/fixture-price");
    first.prepare("UPDATE fixtures SET fixture_date = ?, kickoff_time = ?, kickoff_at = ? WHERE source = ? AND source_id = ?").run(
      "2030-05-12", "15:30", "2030-05-12T14:30:00.000Z", fixture.source, fixture.source_id
    );
    first.prepare("UPDATE fixture_seasons SET ends_on = ?, is_current = 0 WHERE id = 1").run("2030-06-30");
    first.prepare("UPDATE competitions SET name = ? WHERE code = ?").run("Operator competition name", SEED_DATA.competitions[0].code);
    first.prepare("UPDATE division_competition_mappings SET competition_code = 'PL' WHERE division_id = 8").run();
    first.prepare("UPDATE division_assignments SET division_id = ?, admin_updated_at = '2030-01-01T00:00:00.000Z' WHERE club_id = ?").run(divisionAssignment.division_id === 1 ? 2 : 1, divisionAssignment.club_id);
    first.prepare("UPDATE club_venue_assignments SET effective_to = '2030-01-01' WHERE id = ?").run(venueAssignment.id);
    first.prepare("UPDATE pyramid_divisions SET name = ? WHERE id = 1").run("Operator division name");
    first.prepare("UPDATE pyramid_seasons SET season_label = ? WHERE id = 1").run("Operator pyramid season");
    first.prepare("UPDATE travel_cache SET driving_minutes = 77 WHERE rowid = (SELECT MIN(rowid) FROM travel_cache)").run();
    first.prepare("INSERT INTO admin_audit_log (actor, action, entity_type, entity_id) VALUES ('operator', 'update', 'club', ?)").run(String(club.id));
    first.close();

    const readOperationalState = (db: ReturnType<typeof openDatabase>) => ({
      venue: db.prepare("SELECT name FROM venues WHERE id = ?").get(venue.id),
      club: db.prepare("SELECT name, short_name FROM clubs WHERE id = ?").get(club.id),
      clubPrice: db.prepare("SELECT adult_price_pence, source_url FROM club_ticket_prices WHERE club_id = ?").get(club.id),
      fixturePrice: db.prepare("SELECT adult_price_pence, source_url FROM fixture_ticket_price_overrides WHERE fixture_id = ?").get(fixtureId.id),
      fixture: db.prepare("SELECT fixture_date, kickoff_time, kickoff_at FROM fixtures WHERE source = ? AND source_id = ?").get(fixture.source, fixture.source_id),
      fixtureSeason: db.prepare("SELECT ends_on, is_current FROM fixture_seasons WHERE id = 1").get(),
      competition: db.prepare("SELECT name FROM competitions WHERE code = ?").get(SEED_DATA.competitions[0].code),
      mapping: db.prepare("SELECT competition_code FROM division_competition_mappings WHERE division_id = 8").get(),
      divisionAssignment: db.prepare("SELECT club_id, division_id, admin_updated_at FROM division_assignments WHERE club_id = ?").get(divisionAssignment.club_id),
      venueAssignment: db.prepare("SELECT id, effective_to FROM club_venue_assignments WHERE id = ?").get(venueAssignment.id),
      division: db.prepare("SELECT name FROM pyramid_divisions WHERE id = 1").get(),
      pyramidSeason: db.prepare("SELECT season_label FROM pyramid_seasons WHERE id = 1").get(),
      travel: db.prepare("SELECT driving_minutes FROM travel_cache ORDER BY rowid LIMIT 1").get(),
      auditRows: db.prepare("SELECT COUNT(*) as count FROM admin_audit_log WHERE actor = 'operator'").get()
    });
    const expected = {
      venue: { name: "Operator venue name" },
      club: { name: "Operator club name", short_name: "Edited" },
      clubPrice: { adult_price_pence: 4321, source_url: "https://example.com/price" },
      fixturePrice: { adult_price_pence: 7654, source_url: "https://example.com/fixture-price" },
      fixture: { fixture_date: "2030-05-12", kickoff_time: "15:30", kickoff_at: "2030-05-12T14:30:00.000Z" },
      fixtureSeason: { ends_on: "2030-06-30", is_current: 0 },
      competition: { name: "Operator competition name" },
      mapping: { competition_code: "PL" },
      divisionAssignment: { club_id: divisionAssignment.club_id, division_id: divisionAssignment.division_id === 1 ? 2 : 1, admin_updated_at: "2030-01-01T00:00:00.000Z" },
      venueAssignment: { id: venueAssignment.id, effective_to: "2030-01-01" },
      division: { name: "Operator division name" },
      pyramidSeason: { season_label: "Operator pyramid season" },
      travel: { driving_minutes: 77 },
      auditRows: { count: 1 }
    };

    const runtime = openDatabase(filename);
    expect(readOperationalState(runtime)).toEqual(expected);
    runtime.close();

    const repeatedInitialization = await setupDatabase(filename);
    expect(readOperationalState(repeatedInitialization)).toEqual(expected);
    repeatedInitialization.close();
  });

  it("requires explicit setup and migrations before runtime open", async () => {
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-db-runtime-"));
    const missing = path.join(dirname, "missing.sqlite");
    expect(() => openDatabase(missing)).toThrow("Initialize it explicitly with npm run db:setup");
    expect(fs.existsSync(missing)).toBe(false);

    const outdated = path.join(dirname, "outdated.sqlite");
    fs.writeFileSync(outdated, "");
    expect(() => openDatabase(outdated)).toThrow("Run npm run db:migrate before starting the app");
  });

  it("creates a SQLite file and can be run repeatedly without duplicating seed rows", async () => {
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-db-"));
    const filename = path.join(dirname, "nearmefc.sqlite");

    const first = await setupDatabase(filename);
    first.close();

    const second = await setupDatabase(filename);
    const counts = second.prepare(`
      SELECT
        (SELECT COUNT(*) FROM competitions) as competitions,
        (SELECT COUNT(*) FROM clubs) as clubs,
        (SELECT COUNT(*) FROM fixtures WHERE source = 'historical_seed') as seedFixtures,
        (SELECT COUNT(*) FROM travel_cache) as travelRows,
        (SELECT COUNT(*) FROM pyramid_templates) as pyramidTemplates,
        (SELECT COUNT(*) FROM pyramid_divisions) as pyramidDivisions,
        (SELECT COUNT(*) FROM pyramid_edges) as pyramidEdges,
        (SELECT COUNT(*) FROM pyramid_seasons) as pyramidSeasons,
        (SELECT COUNT(*) FROM admin_audit_log) as adminAuditRows
    `).get() as {
      competitions: number;
      clubs: number;
      seedFixtures: number;
      travelRows: number;
      pyramidTemplates: number;
      pyramidDivisions: number;
      pyramidEdges: number;
      pyramidSeasons: number;
      adminAuditRows: number;
    };

    const divisionDisplayOrders = second.prepare(`
      SELECT COUNT(*) as count, COUNT(display_order) as withOrder
      FROM pyramid_divisions
    `).get() as { count: number; withOrder: number };

    const edgeAllocationTypes = second.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN allocation_type = 'fixed' THEN 1 ELSE 0 END) as fixedCount,
        SUM(CASE WHEN allocation_type = 'allocation_dependent' THEN 1 ELSE 0 END) as allocationDepCount
      FROM pyramid_edges
    `).get() as { total: number; fixedCount: number; allocationDepCount: number };

    second.close();

    expect(fs.existsSync(filename)).toBe(true);
    expect(counts).toEqual({
      competitions: 30,
      clubs: totalClubs,
      seedFixtures: 4,
      travelRows: 6,
      pyramidTemplates: 1,
      pyramidDivisions: 52,
      pyramidEdges: 129,
      pyramidSeasons: 1,
      adminAuditRows: 0
    });
    expect(divisionDisplayOrders.count).toBe(52);
    expect(divisionDisplayOrders.withOrder).toBe(52);
    expect(edgeAllocationTypes.total).toBe(129);
    expect(edgeAllocationTypes.fixedCount).toBeGreaterThan(0);
    expect(edgeAllocationTypes.allocationDepCount).toBeGreaterThan(0);
    expect(edgeAllocationTypes.fixedCount + edgeAllocationTypes.allocationDepCount).toBe(129);
  });

  it("migration 008 backfills existing rows with correct display_order and allocation_type", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");

    // Create pre-008 schema (pyramid_divisions and pyramid_edges without new columns)
    db.exec(`
      CREATE TABLE pyramid_templates (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        sport TEXT NOT NULL CHECK (sport IN ('mens')),
        status TEXT NOT NULL CHECK (status IN ('active', 'retired'))
      );
      CREATE TABLE pyramid_divisions (
        id INTEGER PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES pyramid_templates(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        level INTEGER NOT NULL,
        max_size INTEGER NOT NULL CHECK (max_size > 0),
        UNIQUE (template_id, code),
        UNIQUE (id, template_id)
      );
      CREATE TABLE pyramid_edges (
        id INTEGER PRIMARY KEY,
        from_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
        to_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('promotion', 'relegation')),
        UNIQUE (from_division_id, to_division_id, movement_type)
      );
    `);

    // Insert seed data WITHOUT the new columns (as a pre-008 DB would have)
    db.prepare("INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active')").run();
    const insertDivision = db.prepare(
      "INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const d of MEN_PYRAMID_DIVISIONS) {
      insertDivision.run(d.id, d.template_id, d.code, d.name, d.level, d.max_size);
    }
    const insertEdge = db.prepare(
      "INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type) VALUES (?, ?, ?, ?)"
    );
    for (const e of MEN_PYRAMID_EDGES) {
      insertEdge.run(e.id, e.from_division_id, e.to_division_id, e.movement_type);
    }

    // Apply migration 008
    db.exec(`
      ALTER TABLE pyramid_divisions ADD COLUMN display_order INTEGER;

      ALTER TABLE pyramid_edges ADD COLUMN allocation_type TEXT NOT NULL DEFAULT 'allocation_dependent' CHECK (allocation_type IN ('fixed', 'allocation_dependent'));
      ALTER TABLE pyramid_edges ADD COLUMN notes TEXT;
      ALTER TABLE pyramid_edges ADD COLUMN source_url TEXT;

      UPDATE pyramid_divisions
      SET display_order = (
        SELECT COUNT(*)
        FROM pyramid_divisions AS d2
        WHERE d2.level = pyramid_divisions.level
          AND d2.id <= pyramid_divisions.id
      );

      UPDATE pyramid_edges
      SET allocation_type = 'fixed'
      WHERE from_division_id IN (SELECT id FROM pyramid_divisions WHERE level <= 6)
        AND to_division_id IN (SELECT id FROM pyramid_divisions WHERE level <= 6);
    `);

    // Verify every division got a display_order
    const divResult = db.prepare(
      "SELECT COUNT(*) as total, COUNT(display_order) as withOrder FROM pyramid_divisions"
    ).get() as { total: number; withOrder: number };
    expect(divResult.total).toBe(52);
    expect(divResult.withOrder).toBe(52);

    // Verify level-specific display_order
    const l1Orders = db.prepare(
      "SELECT display_order FROM pyramid_divisions WHERE level = 1 ORDER BY id"
    ).all() as { display_order: number }[];
    expect(l1Orders).toEqual([{ display_order: 1 }]);

    const l6Orders = db.prepare(
      "SELECT display_order FROM pyramid_divisions WHERE level = 6 ORDER BY id"
    ).all() as { display_order: number }[];
    expect(l6Orders).toEqual([{ display_order: 1 }, { display_order: 2 }]);

    const l8Orders = db.prepare(
      "SELECT display_order FROM pyramid_divisions WHERE level = 8 ORDER BY id"
    ).all() as { display_order: number }[];
    expect(l8Orders).toEqual([
      { display_order: 1 }, { display_order: 2 }, { display_order: 3 },
      { display_order: 4 }, { display_order: 5 }, { display_order: 6 },
      { display_order: 7 }, { display_order: 8 }
    ]);

    // Verify allocation_type distribution
    const edgeResult = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN allocation_type = 'fixed' THEN 1 ELSE 0 END) as fixedCount,
        SUM(CASE WHEN allocation_type = 'allocation_dependent' THEN 1 ELSE 0 END) as allocationDepCount
      FROM pyramid_edges
    `).get() as { total: number; fixedCount: number; allocationDepCount: number };
    expect(edgeResult.total).toBe(129);
    expect(edgeResult.fixedCount + edgeResult.allocationDepCount).toBe(129);

    // Fixed edges: both divisions level <= 6 (levels 1-6 have ids 1-7)
    const fixedEdges = MEN_PYRAMID_EDGES.filter((e) => {
      const from = MEN_PYRAMID_DIVISIONS.find((d) => d.id === e.from_division_id);
      const to = MEN_PYRAMID_DIVISIONS.find((d) => d.id === e.to_division_id);
      return from != null && to != null && from.level <= 6 && to.level <= 6;
    });
    expect(edgeResult.fixedCount).toBe(fixedEdges.length);

    // Verify a known allocation-dependent edge
    const depEdge = db.prepare(
      "SELECT allocation_type FROM pyramid_edges WHERE id = 13"
    ).get() as { allocation_type: string };
    expect(depEdge.allocation_type).toBe("allocation_dependent");

    db.close();
  });
});
