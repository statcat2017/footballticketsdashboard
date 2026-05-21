-- 019: Add duplicate match result states for import batch rows
--
-- Extends match_result CHECK to support three duplicate states:
--   duplicate_existing_fixture  — row matches an already-imported fixture with no material changes
--   duplicate_pending_batch     — row is already present in another active (unapplied) batch
--   duplicate_same_batch        — duplicate row within the same batch
--
-- SQLite requires recreating the table to change a CHECK constraint.

PRAGMA defer_foreign_keys = ON;
PRAGMA foreign_keys = OFF;

CREATE TABLE import_batch_rows_v2 (
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

INSERT INTO import_batch_rows_v2 (
  id, batch_id, row_index,
  home_participant_raw, away_participant_raw,
  home_participant_resolved_id, away_participant_resolved_id,
  home_is_one_off, away_is_one_off,
  competition_raw, competition_resolved_code,
  venue_raw, venue_resolved_id,
  kickoff_date, kickoff_time,
  status, ticket_url,
  adult_price_pence, concession_price_pence,
  source_url, evidence_json,
  confidence, match_result, warnings_json,
  final_action, final_fixture_id, created_at
)
SELECT
  id, batch_id, row_index,
  home_participant_raw, away_participant_raw,
  home_participant_resolved_id, away_participant_resolved_id,
  home_is_one_off, away_is_one_off,
  competition_raw, competition_resolved_code,
  venue_raw, venue_resolved_id,
  kickoff_date, kickoff_time,
  status, ticket_url,
  adult_price_pence, concession_price_pence,
  source_url, evidence_json,
  confidence, match_result, warnings_json,
  final_action, final_fixture_id, created_at
FROM import_batch_rows;

DROP TABLE import_batch_rows;

ALTER TABLE import_batch_rows_v2 RENAME TO import_batch_rows;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch ON import_batch_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_match ON import_batch_rows(match_result);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_fixture ON import_batch_rows(final_fixture_id);
