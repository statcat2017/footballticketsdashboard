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
});
