-- Expand the competition schema for explicit public categories.
ALTER TABLE competitions ADD COLUMN public_category TEXT NOT NULL DEFAULT 'uncategorized'
  CHECK (public_category IN ('premier-league', 'efl', 'non-league', 'womens', 'cup', 'friendly', 'uncategorized'));
