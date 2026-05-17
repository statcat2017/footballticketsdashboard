-- 012: Fixture Source Registry And Import Batch Model
--
-- Creates the source and batch primitives required for API, agentic scrape,
-- table scrape, upload, and paste imports to share one ingestion workflow.

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
  match_result TEXT CHECK (match_result IN ('insert', 'update', 'skip', 'blocked', 'pending')),
  warnings_json TEXT,
  final_action TEXT CHECK (final_action IN ('insert', 'update', 'skip', 'blocked')),
  final_fixture_id INTEGER REFERENCES fixtures(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_fixture_sources_type ON fixture_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_fixture_sources_trust ON fixture_sources(trust_level);
CREATE INDEX IF NOT EXISTS idx_import_batches_source ON import_batches(source_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_approval ON import_batches(approval_status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch ON import_batch_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_match ON import_batch_rows(match_result);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_fixture ON import_batch_rows(final_fixture_id);
