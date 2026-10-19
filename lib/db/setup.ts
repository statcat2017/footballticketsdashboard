import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { createSqliteAppDatabase } from "./adapter.ts";
import { seedDatabase } from "./seed.ts";
import { applyPendingMigrations, migrationStatus } from "./migrate.ts";

export const defaultDatabasePath = path.join(process.cwd(), "data", "nearmefc.sqlite");

const migrationsDirectory = path.join(process.cwd(), "lib", "db", "migrations");

export function applySchema(db: SqliteDatabase): void {
  db.pragma("foreign_keys = ON");
  applyPendingMigrations(db, migrationsDirectory);
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

export function openDatabase(filename = defaultDatabasePath): SqliteDatabase {
  if (filename !== ":memory:" && !fs.existsSync(filename)) {
    throw new Error(
      `SQLite database is missing at ${filename}. Initialize it explicitly with npm run db:setup before starting the app.`
    );
  }

  const sqlite = new Database(filename);
  try {
    sqlite.pragma("foreign_keys = ON");
    const pending = migrationStatus(sqlite, migrationsDirectory)
      .filter((migration) => migration.applied_at === null)
      .map((migration) => migration.name);
    if (pending.length > 0) {
      throw new Error(
        `SQLite database schema is missing migrations: ${pending.join(", ")}. Run npm run db:migrate before starting the app.`
      );
    }
    return sqlite;
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
