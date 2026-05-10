PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  postcode TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS clubs (
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

CREATE TABLE IF NOT EXISTS fixtures (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  home_club_id INTEGER NOT NULL REFERENCES clubs(id),
  away_club_id INTEGER NOT NULL REFERENCES clubs(id),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  kickoff_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'postponed', 'cancelled', 'finished', 'unknown')),
  is_demo_data INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_data IN (0, 1)),
  is_historical INTEGER NOT NULL DEFAULT 0 CHECK (is_historical IN (0, 1)),
  source_updated_at TEXT,
  imported_at TEXT,
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS admission_prices (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'seed', 'unknown')),
  UNIQUE (club_id, label)
);

CREATE TABLE IF NOT EXISTS travel_cache (
  id INTEGER PRIMARY KEY,
  postcode_district TEXT NOT NULL,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  distance_miles REAL NOT NULL,
  driving_minutes INTEGER,
  public_transport_minutes INTEGER,
  provider TEXT NOT NULL DEFAULT 'seed',
  calculated_at TEXT NOT NULL,
  UNIQUE (postcode_district, venue_id)
);

CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY,
  fixture_id INTEGER REFERENCES fixtures(id),
  club_name TEXT,
  email TEXT,
  price_text TEXT NOT NULL,
  source_url TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_fixtures_competition ON fixtures(competition_code);
CREATE INDEX IF NOT EXISTS idx_travel_cache_lookup ON travel_cache(postcode_district, venue_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_football_data_team_id ON clubs(football_data_team_id) WHERE football_data_team_id IS NOT NULL;
