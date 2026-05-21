-- Remove publish-related columns from clubs table
-- competition_code and status were used for the publish gating workflow
-- which has been removed in favor of deriving competition from division_assignments

-- Step 1: Backfill division_competition_mappings from existing clubs.competition_code
-- Only backfill for divisions that have no mapping yet and whose clubs all agree
INSERT INTO division_competition_mappings (division_id, competition_code)
SELECT da.division_id, c.competition_code
FROM division_assignments da
JOIN clubs c ON c.id = da.club_id
WHERE c.competition_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM division_competition_mappings dcm WHERE dcm.division_id = da.division_id
  )
GROUP BY da.division_id, c.competition_code
HAVING COUNT(DISTINCT c.competition_code) = 1;

-- Step 2: Drop columns
ALTER TABLE clubs DROP COLUMN competition_code;
ALTER TABLE clubs DROP COLUMN status;
