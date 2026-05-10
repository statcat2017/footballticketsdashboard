import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { seedDatabase } from "./seed.ts";
import { schemaSql } from "./schema.ts";

export const defaultDatabasePath = path.join(process.cwd(), "data", "nearmefc.sqlite");

export function applySchema(db: SqliteDatabase): void {
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  addColumnIfMissing(db, "fixtures", "source_updated_at", "TEXT");
  addColumnIfMissing(db, "fixtures", "imported_at", "TEXT");
}

export function setupDatabase(filename = defaultDatabasePath): SqliteDatabase {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  applySchema(db);
  seedDatabase(db);
  return db;
}

function addColumnIfMissing(db: SqliteDatabase, tableName: string, columnName: string, columnDefinition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}
