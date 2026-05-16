-- 008: Add graph layout and edge metadata columns
-- Enables division display ordering and allocation-type classification.

ALTER TABLE pyramid_divisions ADD COLUMN display_order INTEGER;

ALTER TABLE pyramid_edges ADD COLUMN allocation_type TEXT NOT NULL DEFAULT 'allocation_dependent' CHECK (allocation_type IN ('fixed', 'allocation_dependent'));
ALTER TABLE pyramid_edges ADD COLUMN notes TEXT;
ALTER TABLE pyramid_edges ADD COLUMN source_url TEXT;

-- Backfill display_order per level using seed insertion order (ID order within each level matches seed-array order).
UPDATE pyramid_divisions
SET display_order = (
  SELECT COUNT(*)
  FROM pyramid_divisions AS d2
  WHERE d2.level = pyramid_divisions.level
    AND d2.id <= pyramid_divisions.id
);

-- Backfill fixed edges where both connected divisions are levels 1–6.
UPDATE pyramid_edges
SET allocation_type = 'fixed'
WHERE from_division_id IN (SELECT id FROM pyramid_divisions WHERE level <= 6)
  AND to_division_id IN (SELECT id FROM pyramid_divisions WHERE level <= 6);

-- Everything else remains allocation_dependent (the DEFAULT).
