import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import path from "node:path";

import { seedDatabase } from "@/lib/db/seed";
import { schemaSql } from "@/lib/db/schema";

let database: SqliteDatabase | null = null;

export function createDatabase(filename = ":memory:"): SqliteDatabase {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  seedDatabase(db);
  return db;
}

export function getDatabase(): SqliteDatabase {
  if (!database) {
    const configuredPath = process.env.SQLITE_DB_PATH;
    const filename = configuredPath ?? path.join(process.cwd(), "data", "nearmefc.sqlite");
    database = createDatabase(filename);
  }

  return database;
}
