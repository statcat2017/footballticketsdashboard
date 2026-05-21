-- 003: Normalise grounds into venues + club_venue_assignments
-- Removes duplicated ground fields from pyramid_clubs.
-- Adds historical club-to-venue assignment table.

CREATE TABLE IF NOT EXISTS club_venue_assignments (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES pyramid_clubs(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  UNIQUE (club_id, effective_from),
  UNIQUE (club_id, venue_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_club ON club_venue_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_venue ON club_venue_assignments(venue_id);

-- Remove ground fields from pyramid_clubs
-- SQLite doesn't support DROP COLUMN in older versions, but we'll do it safely.
-- For migration, we'll just stop writing to these columns; they're nullable so existing data won't break.
-- New code won't reference these columns.
