-- Rollback 010: Restore fixtures, club_ticket_prices, and fixture_ticket_price_overrides
-- to the previous schema with NOT NULL club columns and the old confidence enum.

PRAGMA defer_foreign_keys = ON;
PRAGMA foreign_keys = OFF;

-- ── Fixtures ────────────────────────────────────────────────

ALTER TABLE fixtures RENAME TO fixtures_new;

CREATE TABLE fixtures (
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

INSERT INTO fixtures (
  id, source, source_id, competition_code, home_club_id, away_club_id,
  venue_id, kickoff_at, status, is_demo_data, is_historical,
  source_updated_at, imported_at
)
SELECT
  id, source, source_id, competition_code, home_club_id, away_club_id,
  venue_id, kickoff_at, status, is_demo_data, is_historical,
  source_updated_at, imported_at
FROM fixtures_new
WHERE home_club_id IS NOT NULL AND away_club_id IS NOT NULL;

DROP TABLE fixtures_new;

-- ── Club ticket prices ──────────────────────────────────────

ALTER TABLE club_ticket_prices RENAME TO club_ticket_prices_new;

CREATE TABLE club_ticket_prices (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'seed', 'unknown'))
);

INSERT INTO club_ticket_prices (
  club_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, confidence
)
SELECT
  club_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at,
  CASE WHEN confidence = 'imported' THEN 'seed' ELSE confidence END
FROM club_ticket_prices_new;

DROP TABLE club_ticket_prices_new;

-- ── Fixture ticket price overrides ──────────────────────────

ALTER TABLE fixture_ticket_price_overrides RENAME TO fixture_ticket_price_overrides_new;

CREATE TABLE fixture_ticket_price_overrides (
  fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  sale_mode TEXT CHECK (sale_mode IN ('all_ticket', 'pay_on_gate') OR sale_mode IS NULL),
  adult_price_pence INTEGER,
  concession_price_pence INTEGER,
  source_url TEXT,
  verified_at TEXT,
  note TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'seed', 'unknown'))
);

INSERT INTO fixture_ticket_price_overrides (
  fixture_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, note, confidence
)
SELECT
  fixture_id, sale_mode, adult_price_pence, concession_price_pence,
  source_url, verified_at, note,
  CASE WHEN confidence = 'imported' THEN 'seed' ELSE confidence END
FROM fixture_ticket_price_overrides_new;

DROP TABLE fixture_ticket_price_overrides_new;

PRAGMA foreign_keys = ON;
