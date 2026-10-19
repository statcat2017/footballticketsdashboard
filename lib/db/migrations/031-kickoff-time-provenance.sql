-- Preserve the timezone basis used to calculate each stored kickoff instant.
ALTER TABLE fixtures ADD COLUMN kickoff_time_basis TEXT;
ALTER TABLE import_batch_rows ADD COLUMN kickoff_offset TEXT;

UPDATE fixtures
SET kickoff_time_basis = 'UTC'
WHERE source = 'football-data' AND kickoff_at IS NOT NULL;

UPDATE fixtures
SET kickoff_time_basis = 'unknown'
WHERE source = 'import_batch' AND kickoff_at IS NOT NULL;
