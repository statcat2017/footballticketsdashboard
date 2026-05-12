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
  addColumnIfMissing(db, "clubs", "football_data_team_id", "INTEGER");
  addColumnIfMissing(db, "clubs", "aliases", "TEXT");
  addColumnIfMissing(db, "clubs", "price_source_url", "TEXT");
  addColumnIfMissing(db, "clubs", "ground_source_url", "TEXT");
  addColumnIfMissing(db, "clubs", "coordinates_source_url", "TEXT");
  addColumnIfMissing(db, "clubs", "verified_at", "TEXT");
  addColumnIfMissing(db, "fixtures", "source_updated_at", "TEXT");
  addColumnIfMissing(db, "fixtures", "imported_at", "TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_football_data_team_id ON clubs(football_data_team_id) WHERE football_data_team_id IS NOT NULL");
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
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}
