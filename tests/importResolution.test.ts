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
  getBatch,
} from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";
import { applyBatchRows } from "@/lib/import/apply";
import {
  validateRowById,
  editAndRevalidateRow,
  importSingleRow,
  skipRow,
  acknowledgeBatchIssue,
  getActiveIssuesForBatch,
  getRowActions,
} from "@/lib/import/resolution";
import type { NormalizedFixtureRow, WarningIssue } from "@/lib/import";

function setupTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

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

describe("structured warnings", () => {
  it("produces both issues and messages arrays in warnings payload", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Unknown FC", awayParticipantRaw: "Chelsea", kickoffDate: "2026-05-20" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    expect(rows[0].matchResult).toBe("blocked");
    expect(rows[0].warningsJson).toBeTruthy();

    const parsed = JSON.parse(rows[0].warningsJson!);
    expect(parsed.issues).toBeInstanceOf(Array);
    expect(parsed.messages).toBeInstanceOf(Array);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.messages.length).toBe(parsed.issues.length);

    const clubIssue = parsed.issues.find((i: WarningIssue) => i.code === "unknown_club");
    expect(clubIssue).toBeTruthy();
    expect(clubIssue.severity).toBe("blocker");
    expect(clubIssue.issueKey).toBe("unknown_club:unknown fc");
    expect(clubIssue.message).toContain("Unknown club: Unknown FC");
  });

  it("includes non-blocking ticket warning as warning severity", async () => {
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
    const rows = await getBatchRows(db, batchId);

    expect(rows[0].matchResult).toBe("insert");
    const parsed = JSON.parse(rows[0].warningsJson!);
    const ticketIssue = parsed.issues.find((i: WarningIssue) => i.code === "missing_ticket_info");
    expect(ticketIssue).toBeTruthy();
    expect(ticketIssue.severity).toBe("warning");
  });
});

describe("validateRowById", () => {
  it("validates a single row and updates its outcome", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Arsenal", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBeNull();
    expect(rows[1].matchResult).toBeNull();

    await validateRowById(db, rows[0].id);

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].matchResult).not.toBeNull();
    expect(updated[1].matchResult).toBeNull();
  });

  it("skips revalidation when row has final action", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("insert");

    await db.run(`UPDATE import_batch_rows SET final_action = 'skip' WHERE id = ?`, [rows[0].id]);
    const result = await validateRowById(db, rows[0].id);
    expect(result.finalAction).toBe("skip");
    expect(result.matchResult).toBe("insert"); // unchanged
  });
});

describe("editAndRevalidateRow", () => {
  it("edits raw fields, logs action, revalidates", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Unknown FC", awayParticipantRaw: "Chelsea", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("blocked");

    // Fix by editing home team to Chelsea
    await editAndRevalidateRow(db, rows[0].id, { homeParticipantRaw: "Chelsea" }, "test_admin");

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].homeParticipantRaw).toBe("Chelsea");
    expect(updated[0].matchResult).toBe("insert");

    // Row action was recorded
    const actions = await getRowActions(db, batchId, rows[0].id);
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe("edit_row");
  });

  it("preserves competitionRaw when editing unrelated fields", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].competitionRaw).toBe("PL");
    expect(rows[0].competitionResolvedCode).toBe("PL");

    // Edit only venue — competitionRaw should not be touched
    await editAndRevalidateRow(db, rows[0].id, { venueRaw: "Loftus Road" }, "test_admin");

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].venueRaw).toBe("Loftus Road");
    expect(updated[0].competitionRaw).toBe("PL");
    expect(updated[0].competitionResolvedCode).toBe("PL");
    expect(updated[0].matchResult).toBe("insert");
  });

  it("refuses to edit a finalized row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    await db.run(`UPDATE import_batch_rows SET final_action = 'skip' WHERE id = ?`, [rows[0].id]);

    await expect(
      editAndRevalidateRow(db, rows[0].id, { homeParticipantRaw: "Arsenal" }, "test_admin")
    ).rejects.toThrow("cannot be edited");
  });
});

describe("importSingleRow", () => {
  it("revalidates row and imports insert row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("insert");

    const result = await importSingleRow(db, rows[0].id, "test_admin");
    expect(result.fixtureId).toBeTruthy();

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].finalAction).toBe("insert");
    expect(updated[0].finalFixtureId).toBe(result.fixtureId);

    // Row action recorded
    const actions = await getRowActions(db, batchId, rows[0].id);
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe("import_insert");
  });

  it("revalidates row and imports update row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Arsenal", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("update");

    const result = await importSingleRow(db, rows[0].id, "test_admin");
    expect(result.fixtureId).toBeTruthy();

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].finalAction).toBe("update");
    expect(updated[0].finalFixtureId).toBe(result.fixtureId);
  });

  it("blocks import when row is still blocked after revalidation", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Unknown FC", awayParticipantRaw: "Chelsea", kickoffDate: "2026-05-20" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    expect(rows[0].matchResult).toBe("blocked");

    const result = await importSingleRow(db, rows[0].id, "test_admin");
    expect(result.fixtureId).toBeNull();
    expect(result.row.matchResult).toBe("blocked");

    const updated = await getBatchRows(db, batchId);
    expect(updated[0].finalAction).toBeNull();
  });

  it("refuses to import a finalized row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    await db.run(`UPDATE import_batch_rows SET final_action = 'skip' WHERE id = ?`, [rows[0].id]);

    await expect(
      importSingleRow(db, rows[0].id, "test_admin")
    ).rejects.toThrow("cannot be imported again");
  });

  it("sets partially_approved when some rows remain", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
      { homeParticipantRaw: "Unknown FC", awayParticipantRaw: "Chelsea", kickoffDate: "2026-05-20" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    await importSingleRow(db, rows[0].id, "test_admin");

    const batch = await getBatch(db, batchId);
    expect(batch?.approvalStatus).toBe("partially_approved");
  });
});

describe("skipRow", () => {
  it("marks row as skipped with reason", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    const updated = await skipRow(db, rows[0].id, "duplicate", "test_admin", "Already imported via other batch");
    expect(updated.finalAction).toBe("skip");

    const rowActions = await getRowActions(db, batchId, rows[0].id);
    expect(rowActions.length).toBe(1);
    expect(rowActions[0].action).toBe("skip");
    expect(rowActions[0].reason).toBe("duplicate");
    expect(rowActions[0].note).toBe("Already imported via other batch");
  });

  it("refuses to skip a finalized row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);
    await db.run(`UPDATE import_batch_rows SET final_action = 'skip' WHERE id = ?`, [rows[0].id]);

    await expect(
      skipRow(db, rows[0].id, "duplicate", "test_admin")
    ).rejects.toThrow("cannot be skipped");
  });

  it("rejects invalid skip reasons", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    await expect(
      skipRow(db, rows[0].id, "invalid_reason", "test_admin")
    ).rejects.toThrow("Invalid skip reason");
  });
});

describe("issue acknowledgement", () => {
  it("resolves issue for whole batch and removes from active issues", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Unknown FC", awayParticipantRaw: "Chelsea", kickoffDate: "2026-05-20" },
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const activeBefore = await getActiveIssuesForBatch(db, batchId);
    expect(activeBefore.length).toBeGreaterThan(0);

    // Acknowledge all missing_ticket_info issues
    await acknowledgeBatchIssue(db, batchId, "missing_ticket_info", "test_admin", { issueCode: "missing_ticket_info" });

    const activeAfter = await getActiveIssuesForBatch(db, batchId);
    const ticketIssues = activeAfter.filter((i) => i.code === "missing_ticket_info");
    expect(ticketIssues.length).toBe(0);
  });

  it("survives revalidation", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);

    await acknowledgeBatchIssue(db, batchId, "missing_ticket_info", "test_admin", { issueCode: "missing_ticket_info" });

    // Revalidate
    await validateImportBatch(db, batchId);

    const active = await getActiveIssuesForBatch(db, batchId);
    const ticketIssues = active.filter((i) => i.code === "missing_ticket_info");
    expect(ticketIssues.length).toBe(0);
  });

  it("resolves issue for a single row", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Arsenal", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    // Acknowledge missing_ticket_info for first row only
    await acknowledgeBatchIssue(db, batchId, "missing_ticket_info", "test_admin", {
      issueCode: "missing_ticket_info",
      rowId: rows[0].id,
    });

    await getActiveIssuesForBatch(db, batchId);
    // Should still be active for the batch (because row was not filtered by batch key)
    // But let's check the resolution was recorded
    const resolutions = await db.all<{ issue_key: string; row_id: number | null }>(
      `SELECT issue_key, row_id FROM import_batch_issue_resolutions WHERE batch_id = ?`,
      [batchId]
    );
    expect(resolutions.length).toBe(1);
    expect(resolutions[0].row_id).toBe(rows[0].id);
  });
});

describe("partially approved batch semantics", () => {
  it("allows active rows in partially approved batch", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Arsenal", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    // Apply one row via single import
    await importSingleRow(db, rows[0].id, "test_admin");

    const batch = await getBatch(db, batchId);
    expect(batch?.approvalStatus).toBe("partially_approved");

    // Should still be able to apply the other row via bulk (it's an update since fixture 100 matches)
    const result = await applyBatchRows(db, batchId, "test_admin");
    expect(result.updated).toBe(1);
  });

  it("rejects fully approved batch", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    await importSingleRow(db, rows[0].id, "test_admin");
    // Now also skip the second row if there isn't one
    const batch = await getBatch(db, batchId);
    expect(batch?.approvalStatus).toBe("approved");

    await expect(
      applyBatchRows(db, batchId, "test_admin")
    ).rejects.toThrow("already been approved");

    await expect(
      importSingleRow(db, rows[0].id, "test_admin")
    ).rejects.toThrow("cannot be imported again");
  });
});

describe("row action table", () => {
  it("records all action types", async () => {
    const db = setupTestDb();
    const sourceId = await createTestSource(db);
    const batchId = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);

    await validateImportBatch(db, batchId);
    const rows = await getBatchRows(db, batchId);

    // import
    const result = await importSingleRow(db, rows[0].id, "test_admin");
    expect(result.fixtureId).toBeTruthy();

    // skip
    await skipRow(db, rows[1].id, "duplicate", "test_admin");

    // edit (third row — add it)
    const batchId2 = await createTestBatch(db, sourceId, [
      { homeParticipantRaw: "Chelsea", awayParticipantRaw: "Norwich City", competitionRaw: "PL", kickoffDate: "2026-05-20", kickoffTime: "15:00", venueRaw: "Stamford Bridge" },
    ]);
    await validateImportBatch(db, batchId2);
    const rows2 = await getBatchRows(db, batchId2);
    await editAndRevalidateRow(db, rows2[0].id, { kickoffTime: "19:45" }, "test_admin");

    // Check actions recorded
    const allActions = await db.all<{ action: string }>(
      `SELECT action FROM import_batch_row_actions ORDER BY id`
    );
    const actionTypes = allActions.map((a) => a.action);
    expect(actionTypes).toContain("import_insert");
    expect(actionTypes).toContain("skip");
    expect(actionTypes).toContain("edit_row");
  });
});
