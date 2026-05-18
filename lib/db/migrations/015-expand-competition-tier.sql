-- 015: Expand competition tier constraint from 4 to 10
-- The pyramid now includes divisions beyond tier 4 (National League at level 5, etc.).
-- SQLite cannot alter CHECK constraints, so we recreate the table.
-- D1 enforces FK constraints and does not allow PRAGMA foreign_keys = OFF,
-- so we use a two-step rename to keep a valid FK target at all times.

CREATE TABLE IF NOT EXISTS competitions_new (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 10)
);

INSERT INTO competitions_new (id, code, name, tier)
  SELECT id, code, name, tier FROM competitions;

ALTER TABLE competitions RENAME TO competitions_old;

ALTER TABLE competitions_new RENAME TO competitions;

DROP TABLE competitions_old;
