CREATE INDEX IF NOT EXISTS idx_ibr_identity_lookup ON import_batch_rows(home_participant_resolved_id, away_participant_resolved_id, competition_resolved_code, kickoff_date);
CREATE INDEX IF NOT EXISTS idx_ibr_raw_lookup ON import_batch_rows(batch_id, home_participant_raw, away_participant_raw, kickoff_date);
