-- 005: Remove unused slots column from pyramid_edges
-- Promotion/relegation counts will be defined explicitly per season via pyramid_movements.

ALTER TABLE pyramid_edges DROP COLUMN slots;
