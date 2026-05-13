import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_TABLE = "_migrations";

export interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

export function ensureMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getAppliedMigrations(db: SqliteDatabase): Set<string> {
  const rows = db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all() as Pick<Migration, "name">[];
  return new Set(rows.map((r) => r.name));
}

export function applyPendingMigrations(db: SqliteDatabase, migrationsDir: string): void {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const name = file;

    db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(name);
    })();
  }
}
