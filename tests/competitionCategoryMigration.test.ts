import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("competition public category migration", () => {
  it("preserves uncertain legacy competitions as uncategorized", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE competitions (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tier INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'league'
      );
      INSERT INTO competitions (code, name, tier, kind) VALUES
        ('PL', 'Premier League', 1, 'league'),
        ('NPLP', 'Northern Premier League Premier Division', 7, 'league'),
        ('WOM', 'Women''s Premier League', 1, 'league'),
        ('CUP', 'Example Cup', 4, 'cup'),
        ('FRIENDLY', 'Friendly matches', 10, 'friendly');
    `);

    const schemaMigration = fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations/030-competition-public-category.sql"),
      "utf8"
    );
    const backfillMigration = fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations/031-backfill-competition-public-category.sql"),
      "utf8"
    );
    db.exec(schemaMigration);
    db.exec(backfillMigration);

    const categories = db.prepare(`
      SELECT code, public_category FROM competitions ORDER BY code
    `).all();
    expect(categories).toEqual([
      { code: "CUP", public_category: "cup" },
      { code: "FRIENDLY", public_category: "friendly" },
      { code: "NPLP", public_category: "uncategorized" },
      { code: "PL", public_category: "premier-league" },
      { code: "WOM", public_category: "uncategorized" },
    ]);

    const backfillRollback = fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations/031-backfill-competition-public-category.down.sql"),
      "utf8"
    );
    const schemaRollback = fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations/030-competition-public-category.down.sql"),
      "utf8"
    );
    db.exec(backfillRollback);
    db.exec(schemaRollback);
    expect(db.prepare("PRAGMA table_info(competitions)").all()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "public_category" })])
    );
    db.close();
  });
});
