import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { setupDatabase } from "@/lib/db/setup";
import {
  createConsistentSqliteBackup,
  inspectSqliteDatabase,
  restoreSqliteSnapshot
} from "@/scripts/sqlite-snapshot-lib";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("SQLite snapshot recovery", () => {
  it("backs up a live WAL database and restores an isolated copy with data and schema intact", async () => {
    const directory = temporaryDirectory();
    const sourcePath = path.join(directory, "source.sqlite");
    const backupPath = path.join(directory, "backup.sqlite");
    const stagingPath = path.join(directory, "staging", "restored.sqlite");
    fs.mkdirSync(path.dirname(stagingPath));

    const source = await setupDatabase(sourcePath);
    try {
      source.pragma("journal_mode = WAL");
      source.pragma("foreign_keys = ON");
      expect(String(source.pragma("journal_mode", { simple: true }))).toBe("wal");
      source.prepare(`
        INSERT INTO fixtures (
          source, source_id, competition_code, home_club_id, away_club_id, venue_id,
          kickoff_at, status, is_demo_data, is_historical, season_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("snapshot-test", "wal-row", "PL", 1, 2, 1, "2030-05-12T19:00:00.000Z", "scheduled", 0, 0, "2025-26");

      const backupInventory = await createConsistentSqliteBackup(sourcePath, backupPath);
      expect(backupInventory.integrityCheck).toEqual(["ok"]);
      expect(backupInventory.foreignKeyViolationCount).toBe(0);
      expect(backupInventory.schemaVersion.migrationCount).toBeGreaterThan(0);
      expect(backupInventory.fixtureCounts.source).toContainEqual({ value: "snapshot-test", count: 1 });
      expect(backupInventory.tableCounts.club_ticket_prices).not.toBeUndefined();
      expect(backupInventory.tableCounts.division_assignments).not.toBeUndefined();

      const stagingInventory = await restoreSqliteSnapshot(backupPath, stagingPath);
      expect(stagingInventory.integrityCheck).toEqual(["ok"]);
      expect(stagingInventory.foreignKeyViolationCount).toBe(0);
      expect(stagingInventory.fixtureCounts).toEqual(backupInventory.fixtureCounts);

      const restored = new Database(stagingPath, { readonly: true, fileMustExist: true });
      try {
        expect(restored.prepare("SELECT source_id FROM fixtures WHERE source = ?").get("snapshot-test"))
          .toEqual({ source_id: "wal-row" });
      } finally {
        restored.close();
      }
    } finally {
      source.close();
    }
  });

  it("refuses to overwrite files or restore over an application database path", async () => {
    const directory = temporaryDirectory();
    const sourcePath = path.join(directory, "source.sqlite");
    const existingPath = path.join(directory, "keep.sqlite");
    const backupPath = path.join(directory, "backup.sqlite");
    const configuredPath = path.join(directory, "configured.sqlite");
    const source = await setupDatabase(sourcePath);
    const originalConfiguredPath = process.env.SQLITE_DB_PATH;

    try {
      fs.writeFileSync(existingPath, "leave this file alone");
      await expect(createConsistentSqliteBackup(sourcePath, existingPath)).rejects.toThrow("refusing to overwrite");
      expect(fs.readFileSync(existingPath, "utf8")).toBe("leave this file alone");

      await createConsistentSqliteBackup(sourcePath, backupPath);
      process.env.SQLITE_DB_PATH = configuredPath;
      await expect(restoreSqliteSnapshot(backupPath, configuredPath)).rejects.toThrow("configured application database path");
      expect(fs.existsSync(configuredPath)).toBe(false);

      delete process.env.SQLITE_DB_PATH;
      const defaultDatabasePath = path.join(process.cwd(), "data", "nearmefc.sqlite");
      await expect(restoreSqliteSnapshot(backupPath, defaultDatabasePath)).rejects.toThrow("configured application database path");
    } finally {
      if (originalConfiguredPath === undefined) delete process.env.SQLITE_DB_PATH;
      else process.env.SQLITE_DB_PATH = originalConfiguredPath;
      source.close();
    }
  });

  it("rejects inconsistent databases and removes the failed snapshot file", async () => {
    const directory = temporaryDirectory();
    const sourcePath = path.join(directory, "broken.sqlite");
    const backupPath = path.join(directory, "must-not-remain.sqlite");
    const source = await setupDatabase(sourcePath);
    try {
      source.pragma("foreign_keys = OFF");
      source.prepare(`
        INSERT INTO fixtures (
          source, source_id, competition_code, home_club_id, away_club_id, venue_id,
          kickoff_at, status, is_demo_data, is_historical
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("snapshot-test", "orphan", "PL", 999999, 2, 1, "2030-05-12T19:00:00.000Z", "scheduled", 0, 0);

      expect(inspectSqliteDatabase(sourcePath).foreignKeyViolationCount).toBeGreaterThan(0);
      await expect(createConsistentSqliteBackup(sourcePath, backupPath)).rejects.toThrow("foreign key check found");
      expect(fs.existsSync(backupPath)).toBe(false);
    } finally {
      source.close();
    }
  });
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-snapshot-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
