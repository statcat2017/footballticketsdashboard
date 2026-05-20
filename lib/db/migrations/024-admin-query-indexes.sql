CREATE INDEX IF NOT EXISTS idx_cva_current_primary ON club_venue_assignments(club_id) WHERE is_primary = 1 AND effective_to IS NULL;
