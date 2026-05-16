-- 008: Add graph layout and edge metadata columns
-- Enables division display ordering and allocation-type classification.

ALTER TABLE pyramid_divisions ADD COLUMN display_order INTEGER;

ALTER TABLE pyramid_edges ADD COLUMN allocation_type TEXT NOT NULL DEFAULT 'allocation_dependent' CHECK (allocation_type IN ('fixed', 'allocation_dependent'));
ALTER TABLE pyramid_edges ADD COLUMN notes TEXT;
ALTER TABLE pyramid_edges ADD COLUMN source_url TEXT;
