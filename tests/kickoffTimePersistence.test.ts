import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { setupDatabase } from "@/lib/db/setup";
import { applyBatchRows } from "@/lib/import/apply";
import { createImportBatchFromCsv, createSource } from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";
import { searchFixtures } from "@/lib/search/service";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("kickoff timezone persistence", () => {
  it("reopens an imported fixture with local fields, UTC instant, and source offset intact", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-kickoff-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "fixtures.sqlite");

    const sqlite = await setupDatabase(databasePath);
    const db = createSqliteAppDatabase(sqlite);
    const source = await createSource(db, { sourceType: "csv_paste", name: "Kickoff test" });
    const batch = await createImportBatchFromCsv(
      db,
      [
        "Home,Away,Date,Time,Competition,Venue",
        "Chelsea,Arsenal,2026-10-25,01:30+01:00,PL,Stamford Bridge"
      ].join("\n"),
      source.id,
      "test"
    );
    const validation = await validateImportBatch(db, batch.batchId);
    expect(validation).toMatchObject({ insertCount: 1, blockedCount: 0 });
    await applyBatchRows(db, batch.batchId, "test");
    sqlite.close();

    const reopened = new Database(databasePath);
    const fixture = reopened.prepare(`
      SELECT fixture_date, kickoff_time, kickoff_at, kickoff_time_basis, kickoff_time_status
      FROM fixtures WHERE source = 'import_batch'
    `).get();
    const importRow = reopened.prepare(`
      SELECT kickoff_offset FROM import_batch_rows WHERE batch_id = ?
    `).get(batch.batchId);
    expect(fixture).toEqual({
      fixture_date: "2026-10-25",
      kickoff_time: "01:30",
      kickoff_at: "2026-10-25T00:30:00.000Z",
      kickoff_time_basis: "+01:00",
      kickoff_time_status: "confirmed"
    });
    expect(importRow).toEqual({ kickoff_offset: "+01:00" });
    reopened.close();
  });

  it("stores and searches the London date when an explicit offset crosses midnight", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-kickoff-midnight-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "fixtures.sqlite");

    const sqlite = await setupDatabase(databasePath);
    const db = createSqliteAppDatabase(sqlite);
    const source = await createSource(db, { sourceType: "csv_paste", name: "Midnight kickoff test" });
    const batch = await createImportBatchFromCsv(
      db,
      [
        "Home,Away,Date,Time,Competition,Venue",
        "Chelsea,Arsenal,2026-07-04,23:30+00:00,PL,Stamford Bridge"
      ].join("\n"),
      source.id,
      "test"
    );
    const validation = await validateImportBatch(db, batch.batchId);
    expect(validation).toMatchObject({ insertCount: 1, blockedCount: 0 });
    await applyBatchRows(db, batch.batchId, "test");
    sqlite.close();

    const reopened = new Database(databasePath);
    const fixture = reopened.prepare(`
      SELECT fixture_date, kickoff_time, kickoff_at, kickoff_time_basis
      FROM fixtures WHERE source = 'import_batch'
    `).get();
    const originalSourceFields = reopened.prepare(`
      SELECT kickoff_date, kickoff_time, kickoff_offset
      FROM import_batch_rows WHERE batch_id = ?
    `).get(batch.batchId);
    expect(fixture).toEqual({
      fixture_date: "2026-07-05",
      kickoff_time: "00:30",
      kickoff_at: "2026-07-04T23:30:00.000Z",
      kickoff_time_basis: "+00:00"
    });
    expect(originalSourceFields).toEqual({
      kickoff_date: "2026-07-04",
      kickoff_time: "23:30",
      kickoff_offset: "+00:00"
    });

    const reopenedDb = createSqliteAppDatabase(reopened);
    const results = await searchFixtures(reopenedDb, {
      postcode: "SW6 1HS",
      dateFrom: "2026-07-04",
      dateTo: "2026-07-05"
    }, {
      postcodeResolver: { resolve: async () => ({ latitude: 51.4817, longitude: -0.191 }) },
      travelProviderOverrides: []
    });
    expect(results.map(({ title, fixtureDate, kickoffAt }) => ({ title, fixtureDate, kickoffAt }))).toContainEqual({
      title: "Chelsea vs Arsenal",
      fixtureDate: "2026-07-05",
      kickoffAt: "2026-07-04T23:30:00.000Z"
    });

    const repeatedBatch = await createImportBatchFromCsv(
      reopenedDb,
      [
        "Home,Away,Date,Time,Competition,Venue",
        "Chelsea,Arsenal,2026-07-04,23:30+00:00,PL,Stamford Bridge"
      ].join("\n"),
      source.id,
      "test"
    );
    const repeatedValidation = await validateImportBatch(reopenedDb, repeatedBatch.batchId);
    expect(repeatedValidation).toMatchObject({ insertCount: 0, updateCount: 0, blockedCount: 0 });

    const repeatedRow = reopened.prepare(
      "SELECT match_result FROM import_batch_rows WHERE batch_id = ?"
    ).get(repeatedBatch.batchId);
    expect(repeatedRow).toEqual({ match_result: "duplicate_existing_fixture" });

    await applyBatchRows(reopenedDb, repeatedBatch.batchId, "test");
    expect(reopened.prepare(
      "SELECT COUNT(*) AS count FROM fixtures WHERE home_club_id = (SELECT id FROM clubs WHERE name = 'Chelsea') AND away_club_id = (SELECT id FROM clubs WHERE name = 'Arsenal') AND fixture_date = '2026-07-05'"
    ).get()).toEqual({ count: 1 });
    reopened.close();
  });
});
