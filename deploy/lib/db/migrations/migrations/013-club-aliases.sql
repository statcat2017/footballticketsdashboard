-- 013: Structured Scoped Club Alias Management
--
-- Creates a club_aliases table for deterministic import matching.
-- Unscoped aliases are globally unique; scoped aliases can duplicate
-- across competitions to support nickname-style disambiguation.

CREATE TABLE IF NOT EXISTS club_aliases (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  competition_code TEXT REFERENCES competitions(code),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT
);

-- Unscoped aliases must be globally unique (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_unscoped
  ON club_aliases(normalized_alias) WHERE competition_code IS NULL AND retired_at IS NULL;

-- Scoped aliases must be unique within their competition scope (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_scoped
  ON club_aliases(normalized_alias, competition_code) WHERE competition_code IS NOT NULL AND retired_at IS NULL;

-- Scoped aliases lookup
CREATE INDEX IF NOT EXISTS idx_club_aliases_club ON club_aliases(club_id);
CREATE INDEX IF NOT EXISTS idx_club_aliases_lookup
  ON club_aliases(normalized_alias, competition_code) WHERE retired_at IS NULL;
