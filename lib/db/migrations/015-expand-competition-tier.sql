-- 015: Expand competition tier constraint from 4 to 10
-- The pyramid now includes divisions beyond tier 4 (National League at level 5, etc.).
-- SQLite cannot alter CHECK constraints, so we recreate the table.
-- PRAGMA defer_foreign_keys defers FK checking to commit time (migrate.ts
-- already wraps each migration in a transaction), so DROP TABLE + RENAME
-- succeed before the merged table is verified against child rows.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions_new (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 10)
);

INSERT INTO competitions_new (id, code, name, tier)
  SELECT id, code, name, tier FROM competitions;

DROP TABLE competitions;

ALTER TABLE competitions_new RENAME TO competitions;

PRAGMA foreign_key_check;
