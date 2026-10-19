-- Backfill only canonical identities already represented by stable metadata.
-- Unknown records remain uncategorized; the seed source writes explicit values.
UPDATE competitions
SET public_category = CASE
  WHEN code = 'PL' THEN 'premier-league'
  WHEN kind = 'cup' THEN 'cup'
  WHEN kind = 'friendly' THEN 'friendly'
  ELSE 'uncategorized'
END;
