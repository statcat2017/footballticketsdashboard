-- 016: Add kind column to competitions table
-- Distinguishes league, cup, and friendly competitions.
-- Friendlies should not imply tables, rounds, or allocated teams.

ALTER TABLE competitions ADD COLUMN kind TEXT NOT NULL DEFAULT 'league' CHECK (kind IN ('league', 'cup', 'friendly'));
