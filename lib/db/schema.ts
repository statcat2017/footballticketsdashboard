// Single source of truth for the database schema. Used by both local SQLite and Cloudflare D1.
export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS pyramid_templates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('mens')),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired'))
);

CREATE TABLE IF NOT EXISTS pyramid_divisions (
  id INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES pyramid_templates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  max_size INTEGER NOT NULL CHECK (max_size > 0),
  UNIQUE (template_id, code),
  UNIQUE (id, template_id)
);

CREATE TABLE IF NOT EXISTS pyramid_edges (
  id INTEGER PRIMARY KEY,
  from_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  to_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('promotion', 'relegation')),
  slots INTEGER NOT NULL DEFAULT 1 CHECK (slots > 0),
  UNIQUE (from_division_id, to_division_id, movement_type)
);

CREATE TABLE IF NOT EXISTS pyramid_seasons (
  id INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES pyramid_templates(id) ON DELETE CASCADE,
  season_label TEXT NOT NULL,
  UNIQUE (template_id, season_label),
  UNIQUE (id, template_id)
);

CREATE TABLE IF NOT EXISTS pyramid_season_divisions (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked')),
  locked_at TEXT,
  UNIQUE (season_id, division_id),
  UNIQUE (id, season_id, template_id),
  FOREIGN KEY (season_id, template_id) REFERENCES pyramid_seasons(id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id, template_id) REFERENCES pyramid_divisions(id, template_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pyramid_clubs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  aliases TEXT,
  league_name TEXT,
  source_url TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('known', 'partial', 'missing'))
);

CREATE TABLE IF NOT EXISTS pyramid_season_memberships (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  season_division_id INTEGER NOT NULL REFERENCES pyramid_season_divisions(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES pyramid_clubs(id) ON DELETE CASCADE,
  UNIQUE (season_id, club_id),
  FOREIGN KEY (season_id, template_id) REFERENCES pyramid_seasons(id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (season_division_id, season_id, template_id) REFERENCES pyramid_season_divisions(id, season_id, template_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pyramid_movements (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  club_id INTEGER NOT NULL REFERENCES pyramid_clubs(id) ON DELETE CASCADE,
  from_season_division_id INTEGER NOT NULL REFERENCES pyramid_season_divisions(id) ON DELETE CASCADE,
  to_season_division_id INTEGER NOT NULL REFERENCES pyramid_season_divisions(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('promotion', 'relegation')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, club_id),
  FOREIGN KEY (season_id, template_id) REFERENCES pyramid_seasons(id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (season_id, club_id) REFERENCES pyramid_season_memberships(season_id, club_id) ON DELETE CASCADE,
  FOREIGN KEY (from_season_division_id, season_id, template_id) REFERENCES pyramid_season_divisions(id, season_id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (to_season_division_id, season_id, template_id) REFERENCES pyramid_season_divisions(id, season_id, template_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  postcode TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1))
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

CREATE TABLE IF NOT EXISTS club_ticket_prices (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'seed', 'unknown'))
);

CREATE TABLE IF NOT EXISTS fixture_ticket_price_overrides (
  fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  note TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'seed', 'unknown'))
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
CREATE INDEX IF NOT EXISTS idx_fixture_ticket_price_overrides_fixture ON fixture_ticket_price_overrides(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_club ON fixtures(home_club_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_club ON fixtures(away_club_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_venue ON fixtures(venue_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff_status ON fixtures(kickoff_at, status, is_historical);
CREATE INDEX IF NOT EXISTS idx_pyramid_divisions_template ON pyramid_divisions(template_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_edges_from ON pyramid_edges(from_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_edges_to ON pyramid_edges(to_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_seasons_template ON pyramid_seasons(template_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_divisions_season ON pyramid_season_divisions(season_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_divisions_division ON pyramid_season_divisions(division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_memberships_season ON pyramid_season_memberships(season_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_memberships_division ON pyramid_season_memberships(season_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_movements_season ON pyramid_movements(season_id);
CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_club ON club_venue_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_venue ON club_venue_assignments(venue_id);
`;
