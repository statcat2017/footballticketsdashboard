-- 010: Add one-off participant support, date/time split, confidence and provenance fields
--
-- This migration recreates the fixtures table to:
-- 1. Make home_club_id / away_club_id nullable (for one-off teams)
-- 2. Add one-off participant columns (flags, display names, evidence)
-- 3. Add fixture_date / kickoff_time / kickoff_time_status
-- 4. Add confidence, source_url, verified_at, notes
-- 5. Relax FK references from NOT NULL to nullable
-- 6. Add CHECK constraints for one-off vs club mutual exclusion
--
-- Also recreates club_ticket_prices and fixture_ticket_price_overrides
-- with the broader confidence enum.

PRAGMA defer_foreign_keys = ON;
PRAGMA foreign_keys = OFF;

-- ── Fixtures table ──────────────────────────────────────────

ALTER TABLE fixtures RENAME TO fixtures_old;

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

INSERT INTO fixtures (
  id, source, source_id, competition_code, home_club_id, away_club_id,
  venue_id, kickoff_at, status, is_demo_data, is_historical,
  confidence, source_updated_at, imported_at
)
SELECT
  id, source, source_id, competition_code, home_club_id, away_club_id,
  venue_id, kickoff_at, status, is_demo_data, is_historical,
  'imported', source_updated_at, imported_at
FROM fixtures_old;

DROP TABLE fixtures_old;

-- ── Club ticket prices ──────────────────────────────────────

ALTER TABLE club_ticket_prices RENAME TO club_ticket_prices_old;

CREATE TABLE club_ticket_prices (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'imported', 'inferred', 'approximate', 'unknown'))
);

INSERT INTO club_ticket_prices (
  club_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, confidence
)
SELECT
  club_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at,
  CASE WHEN confidence = 'seed' THEN 'imported' ELSE confidence END
FROM club_ticket_prices_old;

DROP TABLE club_ticket_prices_old;

-- ── Fixture ticket price overrides ──────────────────────────

ALTER TABLE fixture_ticket_price_overrides RENAME TO fixture_ticket_price_overrides_old;

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

INSERT INTO fixture_ticket_price_overrides (
  fixture_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, note, confidence
)
SELECT
  fixture_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, note,
  CASE WHEN confidence = 'seed' THEN 'imported' ELSE confidence END
FROM fixture_ticket_price_overrides_old;

DROP TABLE fixture_ticket_price_overrides_old;

-- ── Corrections (FK to fixtures needs re-pointing) ──────────

ALTER TABLE corrections RENAME TO corrections_old;

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

INSERT INTO corrections (
  id, fixture_id, club_name, email, price_text, source_url, message, status, created_at
)
SELECT
  id, fixture_id, club_name, email, price_text, source_url, message, status, created_at
FROM corrections_old;

DROP TABLE corrections_old;

PRAGMA foreign_keys = ON;
