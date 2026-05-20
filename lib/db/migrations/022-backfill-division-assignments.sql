INSERT OR IGNORE INTO division_assignments (club_id, division_id, created_at)
SELECT
  psm.club_id,
  psd.division_id,
  CURRENT_TIMESTAMP
FROM pyramid_season_memberships psm
JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
WHERE psm.season_id = (SELECT id FROM pyramid_seasons ORDER BY id DESC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM division_assignments);
