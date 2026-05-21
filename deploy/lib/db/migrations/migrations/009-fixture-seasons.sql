-- 009: Add fixture seasons table
-- Enables duplicate detection, fixture identity, and season-scoped imports.

CREATE TABLE IF NOT EXISTS fixture_seasons (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
