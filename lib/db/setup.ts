import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { createSqliteAppDatabase } from "./adapter.ts";
import { seedDatabase } from "./seed.ts";
import { applyPendingMigrations } from "./migrate.ts";

export const defaultDatabasePath = path.join(process.cwd(), "data", "nearmefc.sqlite");

export function applySchema(db: SqliteDatabase): void {
  db.pragma("foreign_keys = ON");
  const migrationsDir = path.join(process.cwd(), "lib", "db", "migrations");
  applyPendingMigrations(db, migrationsDir);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_football_data_team_id ON clubs(football_data_team_id) WHERE football_data_team_id IS NOT NULL");
}

export async function setupDatabase(filename = defaultDatabasePath): Promise<SqliteDatabase> {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const sqlite = new Database(filename);
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);
  await seedDatabase(db);
  return sqlite;
}
