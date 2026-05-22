CREATE INDEX IF NOT EXISTS idx_ibr_batch_order ON import_batch_rows(batch_id, row_index);
CREATE INDEX IF NOT EXISTS idx_ibr_batch_status ON import_batch_rows(batch_id, final_action, match_result);
