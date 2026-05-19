-- 018: Canonical clubs — merge pyramid_clubs into clubs
-- Removes the dual-table identity. Clubs is now the single source of truth.
-- pyramid_clubs and club_mappings are dropped.
-- Affected FK columns are rebuilt to point to clubs.id.

-- Build an explicit translation: old pyramid_club_id -> canonical clubs.id
-- Priority: 1) existing club_mappings, 2) exact name match, 3) newly inserted row
-- We need pyramid_clubs saved first before we can reference it.
CREATE TABLE _tmp_pyramid_clubs (
  id INTEGER, name TEXT, aliases TEXT, league_name TEXT,
  source_url TEXT, verified_at TEXT, status TEXT, admin_updated_at TEXT
);
INSERT INTO _tmp_pyramid_clubs
  SELECT id, name, aliases, league_name, source_url, verified_at, status, admin_updated_at
  FROM pyramid_clubs;

CREATE TABLE _tmp_clubs AS SELECT * FROM clubs;
CREATE TABLE _tmp_club_mappings AS SELECT * FROM club_mappings;
CREATE TABLE _tmp_club_venue_assignments AS SELECT * FROM club_venue_assignments;
CREATE TABLE _tmp_pyramid_season_memberships AS SELECT * FROM pyramid_season_memberships;
CREATE TABLE _tmp_pyramid_movements AS SELECT * FROM pyramid_movements;
CREATE TABLE _tmp_club_aliases AS SELECT * FROM club_aliases;
CREATE TABLE _tmp_club_ticket_prices AS SELECT * FROM club_ticket_prices;
CREATE TABLE _tmp_fixtures AS SELECT * FROM fixtures;
CREATE TABLE _tmp_fixture_ticket_price_overrides AS SELECT * FROM fixture_ticket_price_overrides;
CREATE TABLE _tmp_corrections AS SELECT * FROM corrections;
CREATE TABLE _tmp_import_batch_rows AS SELECT * FROM import_batch_rows;
CREATE TABLE _tmp_import_batch_row_actions AS SELECT * FROM import_batch_row_actions;

-- Build club ID translation table
CREATE TABLE _tmp_club_id_map (
  pyramid_club_id INTEGER NOT NULL PRIMARY KEY,
  canonical_club_id INTEGER NOT NULL
);
INSERT INTO _tmp_club_id_map (pyramid_club_id, canonical_club_id)
SELECT DISTINCT cm.pyramid_club_id, cm.club_id
FROM _tmp_club_mappings cm;
INSERT INTO _tmp_club_id_map (pyramid_club_id, canonical_club_id)
SELECT pc.id, c.id
FROM _tmp_pyramid_clubs pc
JOIN _tmp_clubs c ON c.name = pc.name
WHERE NOT EXISTS (SELECT 1 FROM _tmp_club_id_map m WHERE m.pyramid_club_id = pc.id);
INSERT INTO _tmp_club_id_map (pyramid_club_id, canonical_club_id)
SELECT pc.id, pc.id
FROM _tmp_pyramid_clubs pc
WHERE NOT EXISTS (SELECT 1 FROM _tmp_club_id_map m WHERE m.pyramid_club_id = pc.id)
  AND NOT EXISTS (SELECT 1 FROM _tmp_clubs c WHERE c.id = pc.id);
-- Remaining orphan pyramid clubs whose ID conflicts with existing clubs
INSERT INTO _tmp_club_id_map (pyramid_club_id, canonical_club_id)
WITH base AS (
  SELECT MAX(max_id) AS value
  FROM (
    SELECT COALESCE(MAX(id), 0) AS max_id FROM _tmp_clubs
    UNION ALL
    SELECT COALESCE(MAX(canonical_club_id), 0) AS max_id FROM _tmp_club_id_map
  )
), remaining AS (
  SELECT pc.id, ROW_NUMBER() OVER (ORDER BY pc.id) AS rn
  FROM _tmp_pyramid_clubs pc
  WHERE NOT EXISTS (SELECT 1 FROM _tmp_club_id_map m WHERE m.pyramid_club_id = pc.id)
)
SELECT r.id, (SELECT value FROM base) + r.rn
FROM remaining r;

-- Drop in dependency order (children before parents)
DROP TABLE fixture_ticket_price_overrides;
DROP TABLE import_batch_row_actions;
DROP TABLE corrections;
DROP TABLE fixtures;
DROP TABLE import_batch_rows;
DROP TABLE club_aliases;
DROP TABLE club_ticket_prices;
DROP TABLE club_venue_assignments;
DROP TABLE club_mappings;
DROP TABLE pyramid_movements;
DROP TABLE pyramid_season_memberships;
DROP TABLE pyramid_clubs;
DROP TABLE clubs;

-- Recreate clubs as canonical identity table
CREATE TABLE clubs (
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

-- Insert existing public clubs
INSERT INTO clubs (
  id, name, football_data_team_id, aliases, short_name,
  competition_code, venue_id, official_site_url, generic_ticket_url,
  price_source_url, ground_source_url, coordinates_source_url, verified_at
)
SELECT
  id, name, football_data_team_id, aliases, short_name,
  competition_code, venue_id, official_site_url, generic_ticket_url,
  price_source_url, ground_source_url, coordinates_source_url, verified_at
FROM _tmp_clubs;

-- Merge pyramid metadata into clubs that have a mapping
UPDATE clubs SET
  status = COALESCE(
    (SELECT pc.status FROM _tmp_club_id_map m JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id WHERE m.canonical_club_id = clubs.id),
    status
  ),
  source_url = COALESCE(
    (SELECT pc.source_url FROM _tmp_club_id_map m JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id WHERE m.canonical_club_id = clubs.id),
    source_url
  ),
  league_name = COALESCE(
    (SELECT pc.league_name FROM _tmp_club_id_map m JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id WHERE m.canonical_club_id = clubs.id),
    league_name
  ),
  admin_updated_at = COALESCE(
    (SELECT pc.admin_updated_at FROM _tmp_club_id_map m JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id WHERE m.canonical_club_id = clubs.id),
    admin_updated_at
  ),
  verified_at = COALESCE(
    (SELECT pc.verified_at FROM _tmp_club_id_map m JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id WHERE m.canonical_club_id = clubs.id),
    verified_at
  )
WHERE EXISTS (
  SELECT 1 FROM _tmp_club_id_map m WHERE m.canonical_club_id = clubs.id
);

-- Insert pyramid-only clubs (no name match in old clubs, and no ID collision)
INSERT INTO clubs (id, name, aliases, verified_at, status, source_url, league_name, admin_updated_at)
SELECT m.canonical_club_id, pc.name, pc.aliases, pc.verified_at, pc.status, pc.source_url, pc.league_name, pc.admin_updated_at
FROM _tmp_club_id_map m
JOIN _tmp_pyramid_clubs pc ON pc.id = m.pyramid_club_id
WHERE NOT EXISTS (SELECT 1 FROM _tmp_clubs c WHERE c.name = pc.name)
  AND NOT EXISTS (SELECT 1 FROM clubs c2 WHERE c2.id = m.canonical_club_id);

-- Recreate pyramid_season_memberships with FK to clubs.id
CREATE TABLE pyramid_season_memberships (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES pyramid_seasons(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  season_division_id INTEGER NOT NULL REFERENCES pyramid_season_divisions(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  UNIQUE (season_id, club_id),
  FOREIGN KEY (season_id, template_id) REFERENCES pyramid_seasons(id, template_id) ON DELETE CASCADE,
  FOREIGN KEY (season_division_id, season_id, template_id) REFERENCES pyramid_season_divisions(id, season_id, template_id) ON DELETE CASCADE
);
INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id)
SELECT m.id, m.season_id, m.template_id, m.season_division_id,
  COALESCE(
    (SELECT map.canonical_club_id FROM _tmp_club_id_map map WHERE map.pyramid_club_id = m.club_id),
    m.club_id
  )
FROM _tmp_pyramid_season_memberships m;

-- Recreate pyramid_movements with FK to clubs.id
CREATE TABLE pyramid_movements (
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
INSERT INTO pyramid_movements (id, season_id, template_id, club_id, from_season_division_id, to_season_division_id, movement_type, note, created_at)
SELECT mv.id, mv.season_id, mv.template_id,
  COALESCE(
    (SELECT map.canonical_club_id FROM _tmp_club_id_map map WHERE map.pyramid_club_id = mv.club_id),
    mv.club_id
  ),
  mv.from_season_division_id, mv.to_season_division_id, mv.movement_type, mv.note, mv.created_at
FROM _tmp_pyramid_movements mv;

-- Recreate club_venue_assignments with FK to clubs.id
CREATE TABLE club_venue_assignments (
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
INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary, admin_updated_at)
SELECT cva.id,
  COALESCE(
    (SELECT map.canonical_club_id FROM _tmp_club_id_map map WHERE map.pyramid_club_id = cva.club_id),
    cva.club_id
  ),
  cva.venue_id, cva.effective_from, cva.effective_to, cva.is_primary, cva.admin_updated_at
FROM _tmp_club_venue_assignments cva;

-- Recreate club_aliases (FK already references clubs.id, unchanged)
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

-- Recreate club_ticket_prices (FK already references clubs.id, unchanged)
CREATE TABLE club_ticket_prices (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown'))
);
INSERT INTO club_ticket_prices SELECT * FROM _tmp_club_ticket_prices;

-- Recreate fixtures (FKs already reference clubs.id, unchanged)
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

-- Recreate corrections (FK to fixtures.id, unchanged)
CREATE TABLE corrections (
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
INSERT INTO corrections SELECT * FROM _tmp_corrections;

-- Recreate fixture_ticket_price_overrides (FK to fixtures.id, unchanged)
CREATE TABLE fixture_ticket_price_overrides (
  fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  note TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown'))
);
INSERT INTO fixture_ticket_price_overrides SELECT * FROM _tmp_fixture_ticket_price_overrides;

-- Recreate import_batch_rows (FKs reference clubs.id and competitions, unchanged)
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

-- Recreate import_batch_row_actions (FK to import_batch_rows, unchanged)
CREATE TABLE import_batch_row_actions (
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
INSERT INTO import_batch_row_actions SELECT * FROM _tmp_import_batch_row_actions;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_unscoped
  ON club_aliases(normalized_alias) WHERE competition_code IS NULL AND retired_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_aliases_scoped
  ON club_aliases(normalized_alias, competition_code) WHERE competition_code IS NOT NULL AND retired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_club_aliases_club ON club_aliases(club_id);
CREATE INDEX IF NOT EXISTS idx_club_aliases_lookup
  ON club_aliases(normalized_alias, competition_code) WHERE retired_at IS NULL;
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
CREATE INDEX IF NOT EXISTS idx_ibr_batch ON import_batch_issue_resolutions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibr_row ON import_batch_issue_resolutions(row_id);
CREATE INDEX IF NOT EXISTS idx_ibra_batch ON import_batch_row_actions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ibra_row ON import_batch_row_actions(row_id);

-- Clean up temp tables including the mapping table
DROP TABLE _tmp_club_id_map;
DROP TABLE _tmp_pyramid_clubs;
DROP TABLE _tmp_clubs;
DROP TABLE _tmp_club_mappings;
DROP TABLE _tmp_club_venue_assignments;
DROP TABLE _tmp_pyramid_season_memberships;
DROP TABLE _tmp_pyramid_movements;
DROP TABLE _tmp_club_aliases;
DROP TABLE _tmp_club_ticket_prices;
DROP TABLE _tmp_fixtures;
DROP TABLE _tmp_fixture_ticket_price_overrides;
DROP TABLE _tmp_corrections;
DROP TABLE _tmp_import_batch_rows;
DROP TABLE _tmp_import_batch_row_actions;
