-- Migration 019: Make competitions.tier nullable with kind-based checks
-- Step 2 of 2 (clubs FK was already made nullable in 018)

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS competitions_new (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER CHECK (tier BETWEEN 1 AND 10),
  kind TEXT NOT NULL DEFAULT 'league' CHECK (kind IN ('league', 'cup', 'friendly')),
  CHECK (
    (kind = 'league' AND tier IS NOT NULL) OR
    (kind IN ('cup', 'friendly') AND tier IS NULL)
  )
);

INSERT INTO competitions_new (id, code, name, tier, kind)
  SELECT id, code, name,
    CASE WHEN kind IN ('cup', 'friendly') THEN NULL ELSE tier END,
    kind
  FROM competitions;

DROP TABLE competitions;
ALTER TABLE competitions_new RENAME TO competitions;

PRAGMA foreign_keys = ON;

-- Update FRIENDLY competition to use tier=NULL
UPDATE competitions SET tier = NULL, kind = 'friendly' WHERE code = 'FRIENDLY';
