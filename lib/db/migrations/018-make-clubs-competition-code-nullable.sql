-- Migration 018: Make clubs.competition_code nullable
-- Step 1 of 2 (runs before 019 so the clubs FK is already nullable
-- when we rebuild competitions)

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS clubs_new (
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
