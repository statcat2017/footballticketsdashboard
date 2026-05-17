-- 011: Add mapping tables for pyramid-club->public-club and division->competition
-- Enables fixture imports to resolve pyramid entities to the public search model.

CREATE TABLE IF NOT EXISTS club_mappings (
  id INTEGER PRIMARY KEY,
  pyramid_club_id INTEGER NOT NULL UNIQUE REFERENCES pyramid_clubs(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS division_competition_mappings (
  id INTEGER PRIMARY KEY,
  division_id INTEGER NOT NULL UNIQUE REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
