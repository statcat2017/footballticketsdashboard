-- Migration 018: Make competitions.tier nullable for cup/friendly,
-- add kind-based tier checks, and allow clubs.competition_code to be NULL.

-- Rebuild competitions table with nullable tier
PRAGMA foreign_keys = OFF;

CREATE TABLE competitions_new (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier INTEGER CHECK (tier BETWEEN 1 AND 10),
  kind TEXT NOT NULL DEFAULT 'league' CHECK (kind IN ('league', 'cup', 'friendly')),
  CHECK (
    (kind = 'league' AND tier IS NOT NULL) OR
    (kind IN ('cup', 'friendly') AND tier IS NULL)
  )
);

INSERT INTO competitions_new (id, code, name, tier, kind)
  SELECT id, code, name, tier, kind FROM competitions;

DROP TABLE competitions;
ALTER TABLE competitions_new RENAME TO competitions;

-- Make clubs.competition_code nullable
CREATE TABLE clubs_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  football_data_team_id INTEGER UNIQUE,
  aliases TEXT,
  short_name TEXT,
  competition_code TEXT REFERENCES competitions(code),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  official_site_url TEXT,
  generic_ticket_url TEXT,
  price_source_url TEXT,
  ground_source_url TEXT,
  coordinates_source_url TEXT,
  verified_at TEXT
);

INSERT INTO clubs_new (
  id, name, football_data_team_id, aliases, short_name, competition_code,
  venue_id, official_site_url, generic_ticket_url, price_source_url,
  ground_source_url, coordinates_source_url, verified_at
) SELECT
  id, name, football_data_team_id, aliases, short_name, competition_code,
  venue_id, official_site_url, generic_ticket_url, price_source_url,
  ground_source_url, coordinates_source_url, verified_at
FROM clubs;

DROP TABLE clubs;
ALTER TABLE clubs_new RENAME TO clubs;

PRAGMA foreign_keys = ON;

-- Update FRIENDLY competition to use tier=NULL
UPDATE competitions SET tier = NULL, kind = 'friendly' WHERE code = 'FRIENDLY';
