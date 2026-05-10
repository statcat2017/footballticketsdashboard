import type { Database as SqliteDatabase } from "better-sqlite3";

import { defaultDatabasePath, setupDatabase } from "@/lib/db/setup";

let database: SqliteDatabase | null = null;

export function createDatabase(filename = ":memory:"): SqliteDatabase {
  return setupDatabase(filename);
}

export function getDatabase(): SqliteDatabase {
  if (!database) {
    const configuredPath = process.env.SQLITE_DB_PATH;
    const filename = configuredPath ?? defaultDatabasePath;
    database = createDatabase(filename);
  }

  return database;
}
