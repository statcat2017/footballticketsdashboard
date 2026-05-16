import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import {
  applyPendingMigrations,
  migrationStatus,
  rollbackLast,
  rollbackTo,
} from "@/lib/db/migrate";

function migrationsDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "migrate-test-"));
}

function writeMigration(dir: string, name: string, sql: string): void {
  fs.writeFileSync(path.join(dir, name), sql, "utf-8");
}

describe("migrate", () => {
  let db: Database.Database;
  let dir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    dir = migrationsDir();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("applies pending migrations and records sha256", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");

    applyPendingMigrations(db, dir);

    const row = db.prepare("SELECT name, sha256 FROM _migrations ORDER BY id").all() as {
      name: string;
      sha256: string | null;
    }[];
    expect(row).toHaveLength(1);
    expect(row[0].name).toBe("001-create-users.sql");
    expect(row[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("second run skips already applied migrations", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");

    applyPendingMigrations(db, dir);
    applyPendingMigrations(db, dir);

    const count = db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get() as { cnt: number };
    expect(count.cnt).toBe(1);
  });

  it("logs warning when applied migration file has been modified", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    applyPendingMigrations(db, dir);

    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    writeMigration(dir, "001-create-users.sql", "ALTER TABLE users ADD COLUMN name TEXT;");
    applyPendingMigrations(db, dir);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("WARNING");
    expect(warnSpy.mock.calls[0][0]).toContain("001-create-users.sql");

    warnSpy.mockRestore();
  });

  it("dry run does not execute SQL or record in _migrations", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");

    applyPendingMigrations(db, dir, { dryRun: true });

    const tableExists = !!db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();
    expect(tableExists).toBe(false);

    const migrationTableExists = !!db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
    ).get();
    expect(migrationTableExists).toBe(false);
  });

  it("rollbackLast rolls back the latest migration and deletes its row", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.sql", "CREATE TABLE posts (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.down.sql", "DROP TABLE posts;");
    applyPendingMigrations(db, dir);

    expect(db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get()).toEqual({ cnt: 2 });

    const result = rollbackLast(db, dir);

    expect(result).toBe("002-add-posts.sql");
    expect(db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get()).toEqual({ cnt: 1 });
    expect(
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'").get()
    ).toBe(false);
    expect(
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()
    ).toBe(true);
  });

  it("rollbackLast returns null when nothing to roll back", () => {
    const result = rollbackLast(db, dir);
    expect(result).toBeNull();
  });

  it("rollbackTo throws when target is not the latest applied migration", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.sql", "CREATE TABLE posts (id INTEGER PRIMARY KEY);");
    applyPendingMigrations(db, dir);

    expect(() => rollbackTo(db, dir, "001-create-users.sql")).toThrow(
      /Cannot roll back "001-create-users.sql" because "002-add-posts.sql" was applied after it/
    );
  });

  it("rollbackTo rolls back when target is the latest applied migration", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.sql", "CREATE TABLE posts (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.down.sql", "DROP TABLE posts;");
    applyPendingMigrations(db, dir);

    const result = rollbackTo(db, dir, "002-add-posts.sql");

    expect(result).toBe("002-add-posts.sql");
    expect(db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get()).toEqual({ cnt: 1 });
  });

  it("rollbackTo returns null when no down file exists", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    applyPendingMigrations(db, dir);

    const result = rollbackTo(db, dir, "001-create-users.sql");
    expect(result).toBeNull();
  });

  it(".down.sql files are not treated as pending up migrations", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "001-create-users.down.sql", "DROP TABLE users;");
    writeMigration(dir, "002-add-posts.sql", "CREATE TABLE posts (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "002-add-posts.down.sql", "DROP TABLE posts;");

    applyPendingMigrations(db, dir);

    const rows = db.prepare("SELECT name FROM _migrations ORDER BY id").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["001-create-users.sql", "002-add-posts.sql"]);
  });

  it("migrationStatus reports applied vs unapplied and down availability", () => {
    writeMigration(dir, "001-create-users.sql", "CREATE TABLE users (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "001-create-users.down.sql", "DROP TABLE users;");
    writeMigration(dir, "002-add-posts.sql", "CREATE TABLE posts (id INTEGER PRIMARY KEY);");

    applyPendingMigrations(db, dir);

    // Add unapplied migrations after initial apply
    writeMigration(dir, "003-add-tags.sql", "CREATE TABLE tags (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "003-add-tags.down.sql", "DROP TABLE tags;");
    writeMigration(dir, "004-extra.sql", "CREATE TABLE extra (id INTEGER PRIMARY KEY);");

    const status = migrationStatus(db, dir);

    expect(status).toHaveLength(4);

    expect(status[0]).toMatchObject({
      name: "001-create-users.sql",
      applied_at: expect.any(String),
      has_down: true,
    });

    expect(status[1]).toMatchObject({
      name: "002-add-posts.sql",
      applied_at: expect.any(String),
      has_down: false,
    });

    expect(status[2]).toMatchObject({
      name: "003-add-tags.sql",
      applied_at: null,
      has_down: true,
    });

    expect(status[3]).toMatchObject({
      name: "004-extra.sql",
      applied_at: null,
      has_down: false,
    });

    for (const row of status) {
      expect(row.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("migrationStatus is read-only (does not create _migrations table)", () => {
    const status = migrationStatus(db, dir);

    expect(status).toHaveLength(0);
    const tableExists = !!db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
    ).get();
    expect(tableExists).toBe(false);
  });

  it("applies multiple migrations in sorted order", () => {
    writeMigration(dir, "002-b.sql", "CREATE TABLE b (id INTEGER PRIMARY KEY);");
    writeMigration(dir, "001-a.sql", "CREATE TABLE a (id INTEGER PRIMARY KEY);");

    applyPendingMigrations(db, dir);

    const rows = db.prepare("SELECT name FROM _migrations ORDER BY id").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["001-a.sql", "002-b.sql"]);
  });

  it("fails with a clear error when a migration has bad SQL", () => {
    writeMigration(dir, "001-bad.sql", "CREATE TABLE");

    expect(() => applyPendingMigrations(db, dir)).toThrow(
      /Migration "001-bad.sql" failed:/
    );

    const count = db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });
});
