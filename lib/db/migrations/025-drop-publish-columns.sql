-- Remove publish-related columns from clubs table
-- competition_code and status were used for the publish gating workflow
-- which has been removed in favor of deriving competition from division_assignments

ALTER TABLE clubs DROP COLUMN competition_code;
ALTER TABLE clubs DROP COLUMN status;
