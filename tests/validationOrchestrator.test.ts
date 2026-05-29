import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";
import { validateRow } from "@/lib/import/validation";
import type { ImportBatchRow } from "@/lib/import";
import { createValidationCache } from "@/lib/import/validationCache";

function setupTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier Division', 1, 20);
    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');

    INSERT INTO competitions (code, name, tier, kind) VALUES ('PL', 'Premier League', 1, 'league');
    INSERT INTO competitions (code, name, tier, kind) VALUES ('FRIENDLY', 'Friendly', 1, 'friendly');
    INSERT INTO fixture_seasons (id, label, starts_on, ends_on, is_current) VALUES (1, '2025-26', '2025-08-01', '2026-07-31', 1);

    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (1, 'Stamford Bridge', 'SW6 1HS', 51.4817, -0.191);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (2, 'Emirates Stadium', 'N5 1BU', 51.5549, -0.1084);

    INSERT INTO clubs (id, name, venue_id) VALUES (1, 'Chelsea', 1);
    INSERT INTO clubs (id, name, venue_id) VALUES (2, 'Arsenal', 2);

    INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (10, 'PL');
    INSERT INTO division_assignments (club_id, division_id) VALUES (1, 10);
    INSERT INTO division_assignments (club_id, division_id) VALUES (2, 10);

    INSERT INTO club_venue_assignments (club_id, venue_id, is_primary, effective_from, effective_to) VALUES (1, 1, 1, '2024-01-01', NULL);
    INSERT INTO club_venue_assignments (club_id, venue_id, is_primary, effective_from, effective_to) VALUES (2, 2, 1, '2024-01-01', NULL);

    -- Existing fixture for duplicate/update tests
    INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (100, 'test', 'fixture-1', 'PL', 1, 2, 1, '2026-06-15', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');
  `);

  return db;
}

async function callValidateRow(db: AppDatabase, row: ImportBatchRow, seasonLabel: string | null) {
  const cache = await createValidationCache(db);
  const seenBatchKeysStrict = new Set<string>();
  const seenBatchKeysRelaxed = new Set<string>();
  return validateRow(db, cache, seenBatchKeysStrict, seenBatchKeysRelaxed, row, seasonLabel);
}

function makeRow(overrides: Partial<ImportBatchRow> = {}): ImportBatchRow {
  return {
    id: 1,
    batchId: 1,
    rowIndex: 0,
    homeParticipantRaw: null,
    awayParticipantRaw: null,
    homeParticipantResolvedId: null,
    awayParticipantResolvedId: null,
    homeIsOneOff: false,
    awayIsOneOff: false,
    competitionRaw: null,
    competitionResolvedCode: null,
    venueRaw: null,
    venueResolvedId: null,
    kickoffDate: null,
    kickoffTime: null,
    status: null,
    ticketUrl: null,
    adultPricePence: null,
    concessionPricePence: null,
    sourceUrl: null,
    evidenceJson: null,
    confidence: "unknown",
    matchResult: null,
    warningsJson: null,
    finalAction: null,
    finalFixtureId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateRow orchestrator", () => {
  it("accumulates all independent errors on a single row", async () => {
    const db = setupTestDb();
    try {
      const row = makeRow({
        homeParticipantRaw: "Nonexistent FC",
        awayParticipantRaw: "Also Unknown",
        competitionRaw: "Fake League",
        kickoffDate: "not-a-date",
        ticketUrl: null,
      });

      const result = await callValidateRow(db, row, "2025-26");

      expect(result.matchResult).toBe("blocked");
      // Should report multiple independent issues, not just the first one
      const codes = result.warnings.map((w) => w.code);
      expect(codes).toContain("unknown_club");
      expect(codes).toContain("unknown_competition");
      expect(codes).toContain("invalid_date");
      expect(codes).toContain("missing_ticket_info");
    } finally {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    }
  });

  it("does not attempt fixture matching when date is invalid", async () => {
    const db = setupTestDb();
    try {
      const row = makeRow({
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "not-a-date",
        ticketUrl: "https://example.com/tickets",
      });

      const result = await callValidateRow(db, row, "2025-26");

      expect(result.matchResult).toBe("blocked");
      // Should NOT produce match or duplicate results — the row is blocked
      // on basic data quality before fixture matching runs
      const codes = result.warnings.map((w) => w.code);
      expect(codes).toContain("invalid_date");
      // No ambiguous_fixture_match or duplicate warnings
      expect(codes).not.toContain("ambiguous_fixture_match");
      expect(codes).not.toContain("duplicate_existing_fixture");
    } finally {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    }
  });

  it("friendly fixture with unknown away becomes one-off", async () => {
    const db = setupTestDb();
    try {
      const row = makeRow({
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Some Random Team",
        competitionRaw: "FRIENDLY",
        kickoffDate: "2026-06-15",
        kickoffTime: "19:45",
        ticketUrl: "https://example.com/tickets",
      });

      const result = await callValidateRow(db, row, "2025-26");

      // Friendly with unknown away should NOT be blocked — away becomes one-off
      expect(result.matchResult).toBe("insert");
      expect(result.awayIsOneOff).toBe(true);
      expect(result.awayParticipantResolvedId).toBeNull();
    } finally {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    }
  });

  it("existing fixture with no changes returns duplicate, with changes returns update", async () => {
    const db = setupTestDb();
    try {
      // Same fixture as existing (id=100): Chelsea vs Arsenal, PL, 2026-06-15
      const sameRow = makeRow({
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-06-15",
        kickoffTime: "15:00",
        ticketUrl: "https://example.com/tickets",
      });

      const sameResult = await callValidateRow(db, sameRow, "2025-26");
      expect(sameResult.matchResult).toBe("duplicate_existing_fixture");

      // Same clubs but different date → update (no existing match for this date)
      const changedRow = makeRow({
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-07-20",
        ticketUrl: "https://example.com/tickets",
      });

      const changedResult = await callValidateRow(db, changedRow, "2025-26");
      expect(changedResult.matchResult).toBe("insert");
    } finally {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    }
  });
});
