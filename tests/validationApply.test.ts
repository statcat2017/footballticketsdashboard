import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";
import {
  createSource,
  createBatch,
  addBatchRows,
  getBatchRows,
  updateBatchRowOutcome,
} from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";
import { applyBatchRows } from "@/lib/import/apply";
import type { NormalizedFixtureRow } from "@/lib/import";

function setupTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  // Insert seed data needed for tests
  db.exec(`
    INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
    INSERT INTO competitions (code, name, tier) VALUES ('ELC', 'Championship', 2);
    INSERT INTO fixture_seasons (id, label, starts_on, ends_on, is_current) VALUES (1, '2025-26', '2025-08-01', '2026-07-31', 1);

    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (1, 'Stamford Bridge', 'SW6 1HS', 51.4817, -0.191);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (2, 'Loftus Road', 'W12 7PJ', 51.509, -0.2321);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (3, 'Emirates Stadium', 'N5 1BU', 51.5549, -0.1084);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (4, 'Old Trafford', 'M16 0RA', 53.4631, -2.2913);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (5, 'Carrow Road', 'NR1 1JE', 52.6221, 1.3091);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (6, 'St Andrew''s', 'B9 4RL', 52.4756, -1.8682);

    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (1, 'Chelsea', 'PL', 1);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (2, 'Arsenal', 'PL', 3);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (3, 'Manchester United', 'PL', 4);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (4, 'Queens Park Rangers', 'ELC', 2);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (5, 'Norwich City', 'ELC', 5);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (6, 'Birmingham City', 'ELC', 6);

    INSERT INTO club_aliases (id, club_id, alias, normalized_alias, source) VALUES (1, 1, 'Chelsea FC', 'chelsea fc', 'manual');

    -- Existing fixtures for identity matching tests
    INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (100, 'test', 'fixture-1', 'PL', 1, 2, 1, '2026-05-20', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');
  `);

  return db;
}

async function createTestSource(db: AppDatabase): Promise<number> {
  const source = await createSource(db, {
    sourceType: "csv_paste",
    name: "Test Source",
  });
  return source.id;
}

async function createTestBatch(
  db: AppDatabase,
  sourceId: number,
  rows: NormalizedFixtureRow[],
): Promise<number> {
  const batch = await createBatch(db, {
    sourceId,
    adapterType: "csv_paste",
    actor: "test",
  });
  const rowInputs = rows.map((row, i) => ({ rowIndex: i, row }));
  await addBatchRows(db, batch.id, rowInputs);
  return batch.id;
}

describe("validateImportBatch", () => {
  it("marks complete row as insert when no existing fixture", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.insertCount).toBe(1);
    expect(result.blockedCount).toBe(0);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("insert");
    expect(rows[0].homeParticipantResolvedId).toBe(1);
    expect(rows[0].awayParticipantResolvedId).toBe(5);
    expect(rows[0].competitionResolvedCode).toBe("PL");
    expect(rows[0].venueResolvedId).toBe(1);
  });

  it("marks row as update when existing fixture identity found", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);
    expect(result.blockedCount).toBe(0);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("update");
    expect(rows[0].homeParticipantResolvedId).toBe(1);
    expect(rows[0].awayParticipantResolvedId).toBe(2);
  });

  it("marks unknown club as blocked", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Unknown Town FC",
        awayParticipantRaw: "Chelsea",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.blockedCount).toBe(1);
    expect(result.insertCount).toBe(0);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("blocked");
    expect(rows[0].warningsJson).toContain("Unknown club");
  });

  it("resolves club via alias", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea FC",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].homeParticipantResolvedId).toBe(1);
  });

  it("resolves competition by name", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "Premier League",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].competitionResolvedCode).toBe("PL");
  });

  it("infers competition from home club when not provided", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].competitionResolvedCode).toBe("PL");
  });

  it("blocks row with invalid date", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        kickoffDate: "not-a-date",
        kickoffTime: "15:00",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.blockedCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).toContain("Invalid date");
  });

  it("blocks row with missing date", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        kickoffTime: "15:00",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.blockedCount).toBe(1);
  });

  it("assumes weekend time 15:00 for saturday", async () => {
    const db = setupTestDb();
    // Add a fixture matching the import row date for identity matching
    db.exec(`
      INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
      VALUES (300, 'test', 'fixture-sat', 'PL', 1, 2, 1, '2026-05-23', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');
    `);
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-23", // Saturday
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).toContain("assumed");
    expect(rows[0].warningsJson).toContain("15:00");
  });

  it("assumes weekday time 19:45 for midweek", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20", // Wednesday
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).toContain("assumed");
    expect(rows[0].warningsJson).toContain("19:45");
  });

  it("blocks one-off home with no venue", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Barcelona XI",
        awayParticipantRaw: "Chelsea",
        homeIsOneOff: true,
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.blockedCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).toContain("explicit venue");
  });

  it("warns about missing ticket info but does not block", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.updateCount).toBe(1);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).toContain("ticket");
  });

  it("skips rows that already have final_action", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
      },
    ]);

    const rows = await getBatchRows(db, batchId);
    await updateBatchRowOutcome(db, rows[0].id, {
      matchResult: "insert",
      finalAction: "insert",
    });

    const result = await validateImportBatch(db, batchId);
    expect(result.validatedCount).toBe(0);
  });
});

describe("applyBatchRows", () => {
  it("applies insert rows and creates fixtures", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);

    const result = await applyBatchRows(db, batchId, "test");
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);

    const fixtures = await db.all<{ id: number; home_club_id: number; away_club_id: number; fixture_date: string }>(
      `SELECT id, home_club_id, away_club_id, fixture_date FROM fixtures WHERE source = 'import_batch'`
    );
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].home_club_id).toBe(1);
    expect(fixtures[0].away_club_id).toBe(5);
    expect(fixtures[0].fixture_date).toBe("2026-05-20");

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].finalAction).toBe("insert");
    expect(rows[0].finalFixtureId).toBe(fixtures[0].id);
  });

  it("applies update rows and updates existing fixtures", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);

    const result = await applyBatchRows(db, batchId, "test");
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);

    const fixture = await db.get<{ id: number; venue_id: number }>(
      `SELECT id, venue_id FROM fixtures WHERE id = 100`
    );
    expect(fixture?.venue_id).toBe(1); // Updated to Stamford Bridge

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].finalAction).toBe("update");
    expect(rows[0].finalFixtureId).toBe(100);
  });

  it("skips blocked rows during apply", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Unknown FC",
        awayParticipantRaw: "Chelsea",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
      },
    ]);

    await validateImportBatch(db, batchId);

    const result = await applyBatchRows(db, batchId, "test");
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("preserves blank fields on update (never erases)", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        // No venueRaw provided - should use existing fixture venue_id
      },
    ]);

    await validateImportBatch(db, batchId);

    await applyBatchRows(db, batchId, "test");

    const fixture = await db.get<{ id: number; venue_id: number; kickoff_time: string | null }>(
      `SELECT id, venue_id, kickoff_time FROM fixtures WHERE id = 100`
    );
    expect(fixture?.venue_id).toBe(1); // Existing venue, not overwritten
    expect(fixture?.kickoff_time).toBe("15:00"); // Updated from import
  });

  it("preserves different existing venue when import row has no venue", async () => {
    const db = setupTestDb();
    // Add a second fixture at a different venue
    db.exec(`
      INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
      VALUES (200, 'test', 'fixture-alt-venue', 'PL', 1, 2, 2, '2026-06-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');
    `);

    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-06-01",
        // No venueRaw provided - should NOT overwrite existing venue_id=2
      },
    ]);

    await validateImportBatch(db, batchId);
    await applyBatchRows(db, batchId, "test");

    const fixture = await db.get<{ venue_id: number }>(
      `SELECT venue_id FROM fixtures WHERE id = 200`
    );
    expect(fixture?.venue_id).toBe(2); // Must NOT be overwritten to Chelsea's default (1)
  });

  it("normalizes status to null when row has no status", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
        // No status provided — should be null/normalized
      },
    ]);

    const result = await validateImportBatch(db, batchId);
    expect(result.insertCount).toBe(1);

    // Status CHECK prevents invalid values at DB level, so null is the only
    // non-valid case that reaches validation. Verify normal flow handles it.
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].warningsJson).not.toContain("Invalid status");
  });

  it("persists normalized date from validation to apply", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "20/05/2026", // Non-ISO date that parseDateField should normalize
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);

    // Check that the import row now has the normalized date
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].kickoffDate).toBe("2026-05-20");
    expect(rows[0].matchResult).toBe("insert");

    await applyBatchRows(db, batchId, "test");

    const fixture = await db.get<{ fixture_date: string }>(
      `SELECT fixture_date FROM fixtures WHERE source = 'import_batch'`
    );
    expect(fixture?.fixture_date).toBe("2026-05-20");
  });

  it("handles stale update rows gracefully (fixture deleted before apply)", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);

    // Delete the fixture that the update row targets
    db.exec("DELETE FROM fixtures WHERE id = 100");

    const result = await applyBatchRows(db, batchId, "test");
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);

    // Row should be marked blocked but recoverable (no final_action)
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("blocked");
    expect(rows[0].finalAction).toBeNull();
    expect(rows[0].finalFixtureId).toBeNull();
    expect(rows[0].warningsJson).toContain("not found at apply time");
  });

  it("rejects already-applied batch", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);
    await applyBatchRows(db, batchId, "test");

    await expect(applyBatchRows(db, batchId, "test")).rejects.toThrow("already been approved");
  });

  it("writes audit log entries for applied fixtures", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Norwich City",
        competitionRaw: "PL",
        kickoffDate: "2026-05-20",
        kickoffTime: "15:00",
        venueRaw: "Stamford Bridge",
      },
    ]);

    await validateImportBatch(db, batchId);
    await applyBatchRows(db, batchId, "test");

    const audit = await db.all<{ action: string; entity_type: string }>(
      `SELECT action, entity_type FROM admin_audit_log WHERE entity_type = 'fixture'`
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("create");
  });
});

describe("validateImportBatch — friendly competition", () => {
  it("allows unknown away team as one-off for friendly competitions", async () => {
    const db = setupTestDb();
    db.exec(`INSERT INTO competitions (code, name, tier, kind) VALUES ('FRIENDLY', 'Non-League Friendlies', NULL, 'friendly');`);

    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Unknown Town United",
        competitionRaw: "Non-League Friendlies",
        kickoffDate: "2026-07-11",
        kickoffTime: "15:00",
      },
    ]);

    await validateImportBatch(db, batchId);

    const rows = await getBatchRows(db, batchId);
    expect(rows).toHaveLength(1);
    expect(rows[0].matchResult).toBe("insert");
    expect(rows[0].awayIsOneOff).toBe(true);
    expect(rows[0].awayParticipantResolvedId).toBeNull();
  });
});
