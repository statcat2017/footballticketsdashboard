import type { Database as SqliteDatabase } from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_TABLE = "_migrations";

export interface Migration {
  id: number;
  name: string;
  sha256: string | null;
  applied_at: string;
}

export interface ApplyOptions {
  dryRun?: boolean;
}

function upMigrationName(file: string): string {
  return file.replace(/\.up\.sql$/, ".sql");
}

function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function ensureMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sha256 TEXT,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    db.exec(`ALTER TABLE ${MIGRATIONS_TABLE} ADD COLUMN sha256 TEXT`);
  } catch {
    /* column already exists — this is the normal path for databases
       created or migrated after sha256 tracking was added */
  }
}

function getAppliedMigrations(db: SqliteDatabase): Map<string, string | null> {
  const rows = db.prepare(`SELECT name, sha256 FROM ${MIGRATIONS_TABLE}`).all() as Pick<Migration, "name" | "sha256">[];
  return new Map(rows.map((r) => [r.name, r.sha256]));
}

function pendingMigrationFiles(migrationsDir: string): string[] {
  return fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

function downMigrationFile(migrationsDir: string, name: string): string | null {
  const stem = name.replace(/\.(up\.)?sql$/, "");
  const candidates = [`.up.sql`, `.sql`].map((ext) => `${stem}.down${ext}`);
  for (const f of candidates) {
    const full = path.join(migrationsDir, f);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function applyPendingMigrations(
  db: SqliteDatabase,
  migrationsDir: string,
  options?: ApplyOptions
): void {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);
  const files = pendingMigrationFiles(migrationsDir);

  for (const file of files) {
    const name = upMigrationName(file);
    const fullPath = path.join(migrationsDir, file);

    if (applied.has(name)) {
      const storedHash = applied.get(name);
      if (storedHash !== null) {
        const currentHash = hashFile(fullPath);
        if (currentHash !== storedHash) {
          console.error(
            `[migrate] WARNING: migration "${name}" has been modified since it was applied. ` +
            `Expected SHA256: ${storedHash}, actual: ${currentHash}`
          );
        }
      }
      continue;
    }

    const sql = fs.readFileSync(fullPath, "utf-8");
    const sha256 = hashFile(fullPath);

    if (options?.dryRun) {
      console.log(`[migrate] DRY RUN would apply: ${name}`);
      console.log(`         SHA256: ${sha256}`);
      continue;
    }

    try {
      db.transaction(() => {
        db.exec(sql);
        db.prepare(
          `INSERT INTO ${MIGRATIONS_TABLE} (name, sha256) VALUES (?, ?)`
        ).run(name, sha256);
      })();
      console.log(`[migrate] applied: ${name}  (${sha256.slice(0, 12)})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Migration "${name}" failed: ${message}`);
    }
  }
}

export function rollbackLast(
  db: SqliteDatabase,
  migrationsDir: string,
  options?: ApplyOptions
): string | null {
  ensureMigrationsTable(db);
  const row = db.prepare(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id DESC LIMIT 1`
  ).get() as Pick<Migration, "name"> | undefined;

  if (!row) {
    console.log("[migrate] nothing to roll back");
    return null;
  }

  return rollbackTo(db, migrationsDir, row.name, options);
}

export function rollbackTo(
  db: SqliteDatabase,
  migrationsDir: string,
  targetName: string,
  options?: ApplyOptions
): string | null {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);

  if (!applied.has(targetName)) {
    console.log(`[migrate] "${targetName}" is not applied, nothing to roll back`);
    return null;
  }

  const downPath = downMigrationFile(migrationsDir, targetName);
  if (!downPath) {
    console.log(`[migrate] no down migration found for "${targetName}" — skipping`);
    return null;
  }

  const sql = fs.readFileSync(downPath, "utf-8");

  if (options?.dryRun) {
    console.log(`[migrate] DRY RUN would roll back: ${targetName}`);
    return targetName;
  }

  try {
    db.transaction(() => {
      db.exec(sql);
      db.prepare(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`).run(targetName);
    })();
    console.log(`[migrate] rolled back: ${targetName}`);
    return targetName;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Rollback of "${targetName}" failed: ${message}`);
  }
}

export interface MigrationStatusRow {
  name: string;
  sha256: string | null;
  applied_at: string | null;
  has_down: boolean;
}

export function migrationStatus(
  db: SqliteDatabase,
  migrationsDir: string
): MigrationStatusRow[] {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);
  const files = pendingMigrationFiles(migrationsDir);
  const appliedNames = new Set(applied.keys());

  const rows: MigrationStatusRow[] = [];

  for (const file of files) {
    const name = upMigrationName(file);
    const isApplied = appliedNames.has(name);
    const fullPath = path.join(migrationsDir, file);
    const sha256 = hashFile(fullPath);
    const hasDown = downMigrationFile(migrationsDir, name) !== null;

    const appliedRow = isApplied
      ? db.prepare(
          `SELECT applied_at FROM ${MIGRATIONS_TABLE} WHERE name = ?`
        ).get(name) as Pick<Migration, "applied_at"> | undefined
      : undefined;

    rows.push({
      name,
      sha256,
      applied_at: appliedRow?.applied_at ?? null,
      has_down: hasDown,
    });
  }

  return rows;
}
