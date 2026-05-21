-- 015: Expand competition tier constraint from 4 to 10
-- The pyramid now includes divisions beyond tier 4 (National League at level 5, etc.).
-- SQLite cannot alter CHECK constraints, so we recreate the table.
-- D1 enforces FK constraints, so child tables must be rebuilt to repoint FKs.

-- Save competition data and child table data to unconstrained temp tables
CREATE TABLE _tmp_competitions AS SELECT * FROM competitions;
CREATE TABLE _tmp_clubs AS SELECT * FROM clubs;
CREATE TABLE _tmp_fixtures AS SELECT * FROM fixtures;
CREATE TABLE _tmp_division_competition_mappings AS SELECT * FROM division_competition_mappings;
CREATE TABLE _tmp_club_aliases AS SELECT * FROM club_aliases;
CREATE TABLE _tmp_import_batch_rows AS SELECT * FROM import_batch_rows;

-- Drop child tables that have FK references to competitions
DROP TABLE club_aliases;
DROP TABLE import_batch_rows;
DROP TABLE division_competition_mappings;
DROP TABLE fixtures;
DROP TABLE clubs;

-- Recreate competitions with expanded tier range
DROP TABLE competitions;
CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 10)
);
INSERT INTO competitions SELECT * FROM _tmp_competitions;

-- Recreate clubs with FK pointing to the new competitions table
CREATE TABLE clubs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  football_data_team_id INTEGER UNIQUE,
  aliases TEXT,
  short_name TEXT,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  official_site_url TEXT,
  generic_ticket_url TEXT,
  price_source_url TEXT,
  ground_source_url TEXT,
  coordinates_source_url TEXT,
  verified_at TEXT
);
INSERT INTO clubs SELECT * FROM _tmp_clubs;

-- Recreate fixtures with FK pointing to competitions and clubs
CREATE TABLE fixtures (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  home_club_id INTEGER REFERENCES clubs(id),
  away_club_id INTEGER REFERENCES clubs(id),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  kickoff_at TEXT,
  fixture_date TEXT,
  kickoff_time TEXT,
  kickoff_time_status TEXT DEFAULT 'unknown' CHECK (kickoff_time_status IN ('confirmed', 'assumed', 'unknown')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'postponed', 'cancelled', 'finished', 'unknown')),
  is_demo_data INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_data IN (0, 1)),
  is_historical INTEGER NOT NULL DEFAULT 0 CHECK (is_historical IN (0, 1)),
  season_label TEXT REFERENCES fixture_seasons(label),
  home_one_off INTEGER NOT NULL DEFAULT 0 CHECK (home_one_off IN (0, 1)),
  away_one_off INTEGER NOT NULL DEFAULT 0 CHECK (away_one_off IN (0, 1)),
  home_one_off_name TEXT,
  away_one_off_name TEXT,
  home_one_off_source TEXT,
  away_one_off_source TEXT,
  confidence TEXT DEFAULT 'imported' CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown')),
  source_url TEXT,
  verified_at TEXT,
  notes TEXT,
  source_updated_at TEXT,
  imported_at TEXT,
  UNIQUE (source, source_id),
  CHECK (
    (home_one_off = 0 AND home_club_id IS NOT NULL) OR
    (home_one_off = 1 AND home_club_id IS NULL AND home_one_off_name IS NOT NULL)
  ),
  CHECK (
    (away_one_off = 0 AND away_club_id IS NOT NULL) OR
    (away_one_off = 1 AND away_club_id IS NULL AND away_one_off_name IS NOT NULL)
  )
);
INSERT INTO fixtures SELECT * FROM _tmp_fixtures;

-- Recreate division_competition_mappings with FK to competitions
CREATE TABLE division_competition_mappings (
  id INTEGER PRIMARY KEY,
  division_id INTEGER NOT NULL UNIQUE REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO division_competition_mappings SELECT * FROM _tmp_division_competition_mappings;

-- Recreate club_aliases with FK to competitions
CREATE TABLE club_aliases (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  competition_code TEXT REFERENCES competitions(code),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT
);
INSERT INTO club_aliases SELECT * FROM _tmp_club_aliases;

-- Recreate import_batch_rows with FK to competitions
CREATE TABLE import_batch_rows (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  home_participant_raw TEXT,
  away_participant_raw TEXT,
  home_participant_resolved_id INTEGER REFERENCES clubs(id),
  away_participant_resolved_id INTEGER REFERENCES clubs(id),
  home_is_one_off INTEGER NOT NULL DEFAULT 0 CHECK (home_is_one_off IN (0, 1)),
  away_is_one_off INTEGER NOT NULL DEFAULT 0 CHECK (away_is_one_off IN (0, 1)),
  competition_raw TEXT,
  competition_resolved_code TEXT REFERENCES competitions(code),
  venue_raw TEXT,
  venue_resolved_id INTEGER REFERENCES venues(id),
  kickoff_date TEXT,
  kickoff_time TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'postponed', 'cancelled', 'finished', 'unknown')),
  ticket_url TEXT,
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  evidence_json TEXT,
  confidence TEXT DEFAULT 'unknown' CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown')),
  match_result TEXT CHECK (match_result IN ('insert', 'update', 'skip', 'blocked', 'pending')),
  warnings_json TEXT,
  final_action TEXT CHECK (final_action IN ('insert', 'update', 'skip', 'blocked')),
  final_fixture_id INTEGER REFERENCES fixtures(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, row_index)
);
INSERT INTO import_batch_rows SELECT * FROM _tmp_import_batch_rows;

-- Drop temp tables
DROP TABLE _tmp_competitions;
DROP TABLE _tmp_clubs;
DROP TABLE _tmp_fixtures;
DROP TABLE _tmp_division_competition_mappings;
DROP TABLE _tmp_club_aliases;
DROP TABLE _tmp_import_batch_rows;
