-- 002: Men's pyramid template and season snapshots

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
  ground_name TEXT,
  ground_address TEXT,
  postcode TEXT,
  latitude REAL,
  longitude REAL,
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

CREATE INDEX IF NOT EXISTS idx_pyramid_divisions_template ON pyramid_divisions(template_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_edges_from ON pyramid_edges(from_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_edges_to ON pyramid_edges(to_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_seasons_template ON pyramid_seasons(template_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_divisions_season ON pyramid_season_divisions(season_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_divisions_division ON pyramid_season_divisions(division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_memberships_season ON pyramid_season_memberships(season_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_season_memberships_division ON pyramid_season_memberships(season_division_id);
CREATE INDEX IF NOT EXISTS idx_pyramid_movements_season ON pyramid_movements(season_id);
