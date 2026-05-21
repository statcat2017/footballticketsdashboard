-- Index to accelerate import fixture candidate match queries.
-- The WHERE clause typically filters by competition_code, season_label, then
-- home_club_id, away_club_id, and optionally fixture_date. This order matches
-- the query pattern and allows SQLite to narrow results via index range scan.

CREATE INDEX IF NOT EXISTS idx_fixtures_candidate_match
  ON fixtures(competition_code, season_label, home_club_id, away_club_id, fixture_date);
