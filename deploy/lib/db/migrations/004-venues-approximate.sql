-- 004: Add is_approximate flag to venues
-- Allows marking venues whose coordinates are best-effort for later enrichment.

ALTER TABLE venues ADD COLUMN is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1));
