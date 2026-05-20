-- 023: Retire season-scoped pyramid tables
--
-- division_assignments is now the sole source of truth for club-to-division
-- assignments. These tables supported multi-season tracking and promotion/
-- relegation modelling that we no longer need.

DROP TABLE IF EXISTS pyramid_movements;
DROP TABLE IF EXISTS pyramid_season_memberships;
DROP INDEX IF EXISTS idx_pyramid_season_memberships_season;
DROP INDEX IF EXISTS idx_pyramid_season_memberships_division;
DROP TABLE IF EXISTS pyramid_season_divisions;
DROP INDEX IF EXISTS idx_pyramid_season_divisions_season;
DROP INDEX IF EXISTS idx_pyramid_season_divisions_division;
