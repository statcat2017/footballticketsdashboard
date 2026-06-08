import type { Database as SqliteDatabase } from "better-sqlite3";

import { createSqliteAppDatabase, type AppDatabase } from "./adapter.ts";
import { defaultDatabasePath, setupDatabase } from "./setup.ts";

let database: AppDatabase | null = null;
let databasePromise: Promise<AppDatabase> | null = null;

export async function createDatabase(filename = ":memory:"): Promise<SqliteDatabase> {
  return setupDatabase(filename);
}

export async function createAppDatabase(filename = ":memory:"): Promise<AppDatabase> {
  return createSqliteAppDatabase(await createDatabase(filename));
}

export async function getDatabase(): Promise<AppDatabase> {
  if (database) return database;
  if (!databasePromise) {
    databasePromise = (async () => {
      try {
        const configuredPath = process.env.SQLITE_DB_PATH;
        const filename = configuredPath ?? defaultDatabasePath;
        database = await createAppDatabase(filename);
        return database;
      } catch (err) {
        databasePromise = null;
        console.error("Failed to create SQLite database:", err);
        throw err;
      }
    })();
  }
  return databasePromise;
}
