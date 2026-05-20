-- 020: Add division_assignments table
--
-- Replaces pyramid_season_memberships as the source of truth for
-- "which division is each club in right now?" No history, no season ID.

CREATE TABLE IF NOT EXISTS division_assignments (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id) ON DELETE CASCADE,
  admin_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill from current latest-season pyramid memberships
INSERT OR IGNORE INTO division_assignments (club_id, division_id, created_at)
SELECT
  psm.club_id,
  d.id AS division_id,
  CURRENT_TIMESTAMP
FROM pyramid_season_memberships psm
JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
JOIN pyramid_divisions d ON d.id = psd.division_id
WHERE psm.season_id = (SELECT id FROM pyramid_seasons ORDER BY id DESC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM division_assignments);
