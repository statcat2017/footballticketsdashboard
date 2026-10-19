CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_football_data_team_id
ON clubs(football_data_team_id)
WHERE football_data_team_id IS NOT NULL;
