import type { Database as SqliteDatabase } from "better-sqlite3";

import { createSqliteAppDatabase, type AppDatabase } from "./adapter.ts";
import { defaultDatabasePath, setupDatabase } from "./setup.ts";

let database: AppDatabase | null = null;

export function createDatabase(filename = ":memory:"): SqliteDatabase {
  return setupDatabase(filename);
}

export function createAppDatabase(filename = ":memory:"): AppDatabase {
  return createSqliteAppDatabase(createDatabase(filename));
}

export async function getDatabase(): Promise<AppDatabase> {
  if (!database) {
    try {
      const configuredPath = process.env.SQLITE_DB_PATH;
      const filename = configuredPath ?? defaultDatabasePath;
      database = createAppDatabase(filename);
    } catch (err) {
      console.error("Failed to create SQLite database:", err);
      throw err;
    }
  }

  return database;
}
