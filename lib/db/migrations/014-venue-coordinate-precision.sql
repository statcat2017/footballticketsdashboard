-- 014: Venue coordinate precision and provenance
-- Adds coordinate_precision, coordinates_verified_at, coordinates_confidence, and coordinates_notes to venues.

ALTER TABLE venues ADD COLUMN coordinate_precision TEXT DEFAULT 'unknown'
  CHECK (coordinate_precision IN ('exact', 'postcode', 'ground_approximate', 'unknown'));

ALTER TABLE venues ADD COLUMN coordinates_verified_at TEXT;

ALTER TABLE venues ADD COLUMN coordinates_confidence TEXT DEFAULT 'unknown'
  CHECK (coordinates_confidence IN ('high', 'medium', 'low', 'unknown'));

ALTER TABLE venues ADD COLUMN coordinates_notes TEXT;

-- Backfill: existing venues with is_approximate=0 (manually set, may be unreliable) get ground_approximate; is_approximate=1 get unknown
UPDATE venues SET coordinate_precision = 'ground_approximate' WHERE is_approximate = 0 AND coordinate_precision = 'unknown';
UPDATE venues SET coordinate_precision = 'unknown' WHERE is_approximate = 1 AND coordinate_precision = 'unknown';
