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
  db.exec(`
    INSERT INTO club_ticket_prices (
      club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence
    )
    SELECT
      club_id,
      NULL,
      MAX(amount_pence),
      NULL,
      MAX(source_url),
      MAX(verified_at),
      COALESCE(MAX(confidence), 'unknown')
    FROM admission_prices
    GROUP BY club_id
    ON CONFLICT(club_id) DO NOTHING
  `);
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
