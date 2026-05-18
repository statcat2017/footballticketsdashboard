-- Migration 017: import batch issue resolutions and row actions
-- Supports single-fixture resolution workflow, issue acknowledgements, and row-edits.

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
