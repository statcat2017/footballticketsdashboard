import Database from "better-sqlite3";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { runDataQualityChecks } from "@/lib/admin/dataQuality";
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

function minimalDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  return createSqliteAppDatabase(sqlite);
}

describe("data quality checks", () => {
  it("detects clubs with no primary venue", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier Division', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Homeless FC', 'known'), (101, 'Housed FC', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
        (100, 1, 1, 10, 100), (101, 1, 1, 10, 101);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Stadium', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
        (101, 101, 50, '2025-08-01', NULL, 1);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("no-primary-venue"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Homeless FC");
    expect(match[0].severity).toBe("error");
  });

  it("detects mapped clubs at venues with invalid coordinates", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier Division', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Bad Venue Club', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Broken Ground', 'BG1 1XX', 999, 0);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (100, 100, 50, '2025-08-01', NULL, 1);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id, generic_ticket_url) VALUES (200, 'Mapped Bad Venue', 'PL', 50, 'https://tickets.example.com');
      INSERT INTO club_mappings (id, pyramid_club_id, club_id) VALUES (1, 100, 200);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("mapped-club-no-venue"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Mapped Bad Venue");
    expect(match[0].severity).toBe("error");
  });

  it("detects venues with blank postcode", async () => {
    const db = minimalDb();
    db.exec(`INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'No Postcode', '', 51.5, -0.1);`);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("blank-postcode"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("No Postcode");
    expect(match[0].severity).toBe("warning");
  });

  it("detects venues with invalid coordinates", async () => {
    const db = minimalDb();
    db.exec(`INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Bad Coords', 'BC1 1XX', 999, 0);`);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("invalid-coords"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Bad Coords");
    expect(match[0].severity).toBe("error");
  });

  it("detects venues with imprecise coordinates", async () => {
    const db = minimalDb();
    db.exec(`INSERT INTO venues (id, name, postcode, latitude, longitude, coordinate_precision) VALUES
      (50, 'Approx Arena', 'AA1 1AA', 51.5, -0.1, 'ground_approximate');`);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("imprecise-coords"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Approx Arena");
    expect(match[0].severity).toBe("warning");
  });

  it("detects duplicate aliases", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Club A', 'known'), (101, 'Club B', 'known');
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1), (2, 'ELC', 'Championship', 2);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'Pub A', 'PL', 50), (201, 'Pub B', 'ELC', 50);
      INSERT INTO club_aliases (id, club_id, alias, normalized_alias, competition_code) VALUES
        (1, 200, 'Same', 'same', 'PL'),
        (2, 201, 'Same', 'same', 'ELC');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("duplicate-alias"));
    expect(match).toHaveLength(1);
    expect(match[0].severity).toBe("warning");
  });

  it("detects clubs without ticket URL", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO clubs (id, name, competition_code, venue_id, generic_ticket_url) VALUES
        (200, 'Has Tickets', 'PL', 50, 'https://tickets.example.com'),
        (201, 'No Tickets', 'PL', 50, NULL);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("no-ticket-url"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("No Tickets");
    expect(match[0].severity).toBe("info");
  });

  it("detects divisions over max size", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Overcrowded Division', 1, 1);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'C1', 'known'), (101, 'C2', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
        (100, 1, 1, 10, 100), (101, 1, 1, 10, 101);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("division-over-size"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Overcrowded Division");
    expect(match[0].severity).toBe("warning");
  });

  it("detects divisions without competition mapping", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES
        (10, 1, 'mapped', 'Mapped Division', 1, 20),
        (11, 1, 'unmapped', 'Unmapped Division', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES
        (10, 1, 1, 10, 'open'), (11, 1, 1, 11, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'C1', 'known'), (101, 'C2', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES
        (100, 1, 1, 10, 100), (101, 1, 1, 11, 101);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("division-no-mapping"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Unmapped Division");
    expect(match[0].severity).toBe("warning");
  });

  it("detects clubs without public mapping", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Unmapped Club', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("club-no-mapping"));
    expect(match).toHaveLength(1);
    expect(match[0].entity).toBe("Unmapped Club");
    expect(match[0].severity).toBe("warning");
  });

  it("detects fixtures missing source URL", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'C', 'PL', 50), (201, 'D', 'PL', 50);
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 201, '2026-05-20T15:00:00Z', 'confirmed', 'scheduled', NULL);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("fixture-no-source-url"));
    expect(match).toHaveLength(1);
    expect(match[0].severity).toBe("info");
  });

  it("detects fixtures with assumed kickoff", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'C', 'PL', 50), (201, 'D', 'PL', 50);
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 201, '2026-05-20T15:00:00Z', 'assumed', 'scheduled', 'https://example.com');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("fixture-assumed-kickoff"));
    expect(match).toHaveLength(1);
    expect(match[0].severity).toBe("warning");
  });

  it("detects fixtures missing ticket info", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'C', 'PL', 50), (201, 'D', 'PL', 50);
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 201, '2026-05-20T15:00:00Z', 'confirmed', 'scheduled', 'https://example.com');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("fixture-no-ticket"));
    expect(match.length).toBeGreaterThan(0);
    expect(match[0].severity).toBe("info");
  });

  it("detects fixtures hidden by bad venue location", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Broken Ground', 'BG1 1XX', 999, 0);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'C', 'PL', 50), (201, 'D', 'PL', 50);
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 201, '2026-05-20T15:00:00Z', 'confirmed', 'scheduled', 'https://example.com');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const match = issues.filter((i) => i.id.startsWith("fixture-hidden-location"));
    expect(match).toHaveLength(1);
    expect(match[0].severity).toBe("error");
  });

  it("sorts errors before warnings before info", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'C', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'V', '', 999, 0);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'Pub C', 'PL', 50);
      INSERT INTO club_mappings (id, pyramid_club_id, club_id) VALUES (1, 100, 200);
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 200, '2026-05-20T15:00:00Z', 'assumed', 'scheduled', NULL);
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    const errorIndex = issues.findIndex((i) => i.severity === "error");
    const warningIndex = issues.findIndex((i) => i.severity === "warning");
    const infoIndex = issues.findIndex((i) => i.severity === "info");

    expect(errorIndex).toBeLessThan(warningIndex);
    expect(warningIndex).toBeLessThan(infoIndex);
  });

  it("returns empty array when no issues exist", async () => {
    const db = minimalDb();
    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier', 1, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Healthy Club', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
      INSERT INTO venues (id, name, postcode, latitude, longitude, coordinate_precision) VALUES
        (50, 'Healthy Ground', 'TE1 1ST', 51.5, -0.1, 'exact');
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
        (100, 100, 50, '2025-08-01', NULL, 1);
      INSERT INTO competitions (id, code, name, tier) VALUES (1, 'PL', 'Premier League', 1);
      INSERT INTO clubs (id, name, competition_code, venue_id, generic_ticket_url) VALUES
        (200, 'Healthy Public Club', 'PL', 50, 'https://tickets.example.com');
      INSERT INTO club_mappings (id, pyramid_club_id, club_id) VALUES (1, 100, 200);
      INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');
      INSERT INTO fixtures (id, source, source_id, competition_code, venue_id, home_club_id, away_club_id, kickoff_at, kickoff_time_status, status, source_url) VALUES
        (1, 'test', 'f1', 'PL', 50, 200, 200, '2026-05-20T15:00:00Z', 'confirmed', 'scheduled', 'https://example.com');
      INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, confidence) VALUES
        (200, 'all_ticket', 2500, 1500, 'https://tickets.example.com', 'verified');
    `);
    getDatabase.mockResolvedValue(db);

    const issues = await runDataQualityChecks();
    expect(issues).toHaveLength(0);
  });
});
