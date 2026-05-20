// Single source of truth for the database schema. Used by both local SQLite and Cloudflare D1.
export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 10),
  kind TEXT NOT NULL DEFAULT 'league' CHECK (kind IN ('league', 'cup', 'friendly'))
);

CREATE TABLE IF NOT EXISTS fixture_seasons (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  display_order INTEGER,
  UNIQUE (template_id, code),
  UNIQUE (id, template_id)
);

CREATE TABLE IF NOT EXISTS pyramid_edges (
  id INTEGER PRIMARY KEY,
  from_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  to_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('promotion', 'relegation')),
  allocation_type TEXT NOT NULL DEFAULT 'allocation_dependent' CHECK (allocation_type IN ('fixed', 'allocation_dependent')),
  notes TEXT,
  source_url TEXT,
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

CREATE TABLE IF NOT EXISTS pyramid_season_memberships (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  season_division_id INTEGER NOT NULL REFERENCES pyramid_season_divisions(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  UNIQUE (season_id, club_id),
  FOREIGN KEY (season_id, template_id) REFERENCES pyramid_seasons(id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (season_division_id, season_id, template_id) REFERENCES pyramid_season_divisions(id, season_id, template_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pyramid_movements (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
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
  is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1)),
  admin_updated_at TEXT,
  coordinate_precision TEXT DEFAULT 'unknown' CHECK (coordinate_precision IN ('exact', 'postcode', 'ground_approximate', 'unknown')),
  coordinates_verified_at TEXT,
  coordinates_confidence TEXT DEFAULT 'unknown' CHECK (coordinates_confidence IN ('high', 'medium', 'low', 'unknown')),
  coordinates_notes TEXT
);

CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  football_data_team_id INTEGER UNIQUE,
  aliases TEXT,
  short_name TEXT,
  competition_code TEXT REFERENCES competitions(code),
  venue_id INTEGER REFERENCES venues(id),
  official_site_url TEXT,
  generic_ticket_url TEXT,
  price_source_url TEXT,
  ground_source_url TEXT,
  coordinates_source_url TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('known', 'partial', 'missing')),
  source_url TEXT,
  league_name TEXT,
  admin_updated_at TEXT,
  coordinate_precision TEXT DEFAULT 'unknown' CHECK (coordinate_precision IN ('exact', 'postcode', 'ground_approximate', 'unknown')),
  coordinates_verified_at TEXT,
  coordinates_confidence TEXT DEFAULT 'unknown' CHECK (coordinates_confidence IN ('high', 'medium', 'low', 'unknown')),
  coordinates_notes TEXT
);

CREATE TABLE IF NOT EXISTS division_assignments (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  admin_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixtures (
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

CREATE TABLE IF NOT EXISTS club_ticket_prices (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown'))
);

CREATE TABLE IF NOT EXISTS fixture_ticket_price_overrides (
  fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  note TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown'))
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
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  admin_updated_at TEXT,
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

CREATE TABLE IF NOT EXISTS division_competition_mappings (
  id INTEGER PRIMARY KEY,
  division_id INTEGER NOT NULL UNIQUE REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  competition_code TEXT NOT NULL REFERENCES competitions(code),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_unscoped
  ON club_aliases(normalized_alias) WHERE competition_code IS NULL AND retired_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_scoped
  ON club_aliases(normalized_alias, competition_code) WHERE competition_code IS NOT NULL AND retired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_club_aliases_club ON club_aliases(club_id);
CREATE INDEX IF NOT EXISTS idx_club_aliases_lookup
  ON club_aliases(normalized_alias, competition_code) WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixture_sources (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('api_feed', 'agent_scrape', 'url_table_scrape', 'csv_upload', 'csv_paste', 'manual')),
  name TEXT NOT NULL,
  base_url TEXT,
  trust_level TEXT NOT NULL DEFAULT 'untrusted' CHECK (trust_level IN ('trusted', 'moderated', 'untrusted')),
  auto_approval INTEGER NOT NULL DEFAULT 0 CHECK (auto_approval IN (0, 1)),
  evidence_requirements TEXT,
  last_success_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES fixture_sources(id),
  adapter_type TEXT NOT NULL CHECK (adapter_type IN ('api_feed', 'agent_scrape', 'url_table_scrape', 'csv_upload', 'csv_paste', 'manual')),
  season_label TEXT REFERENCES fixture_seasons(label),
  actor TEXT NOT NULL,
  raw_payload TEXT,
  raw_payload_size_bytes INTEGER,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsing', 'parsed', 'failed')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'preview', 'approved', 'partially_approved', 'auto_approved', 'failed')),
  row_count_total INTEGER NOT NULL DEFAULT 0,
  row_count_approved INTEGER NOT NULL DEFAULT 0,
  row_count_failed INTEGER NOT NULL DEFAULT 0,
  parse_errors_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_batch_rows (
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
  match_result TEXT CHECK (match_result IN ('insert', 'update', 'skip', 'blocked', 'pending', 'duplicate_existing_fixture', 'duplicate_pending_batch', 'duplicate_same_batch')),
  warnings_json TEXT,
  final_action TEXT CHECK (final_action IN ('insert', 'update', 'skip', 'blocked')),
  final_fixture_id INTEGER REFERENCES fixtures(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, row_index)
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
CREATE INDEX IF NOT EXISTS idx_division_assignments_division_id ON division_assignments(division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_movements_season ON pyramid_movements(season_id);
CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_club ON club_venue_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_club_venue_assignments_venue ON club_venue_assignments(venue_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(season_label);
CREATE INDEX IF NOT EXISTS idx_fixtures_identity ON fixtures(home_club_id, away_club_id, competition_code, season_label);
CREATE INDEX IF NOT EXISTS idx_fixture_sources_type ON fixture_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_fixture_sources_trust ON fixture_sources(trust_level);
CREATE INDEX IF NOT EXISTS idx_import_batches_source ON import_batches(source_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_approval ON import_batches(approval_status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch ON import_batch_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_match ON import_batch_rows(match_result);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_fixture ON import_batch_rows(final_fixture_id);

CREATE TABLE IF NOT EXISTS import_batch_issue_resolutions (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_id INTEGER,
  issue_code TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  resolution_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ibr_batch ON import_batch_issue_resolutions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibr_row ON import_batch_issue_resolutions(row_id);

CREATE TABLE IF NOT EXISTS import_batch_row_actions (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_id INTEGER NOT NULL REFERENCES import_batch_rows(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'import_insert', 'import_update', 'skip', 'edit_row'
  )),
  reason TEXT,
  note TEXT,
  actor TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ibra_batch ON import_batch_row_actions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibra_row ON import_batch_row_actions(row_id);
`;
