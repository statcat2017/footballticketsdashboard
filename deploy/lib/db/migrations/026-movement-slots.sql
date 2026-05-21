CREATE TABLE IF NOT EXISTS movement_slots (
  id INTEGER PRIMARY KEY,
  source_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id),
  target_division_id INTEGER NOT NULL REFERENCES pyramid_divisions(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('promotion', 'relegation', 'migration')),
  slot_index INTEGER NOT NULL,
  club_id INTEGER REFERENCES clubs(id),
  notes TEXT,
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_division_id, target_division_id, movement_type, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_movement_slots_source ON movement_slots(source_division_id);
CREATE INDEX IF NOT EXISTS idx_movement_slots_target ON movement_slots(target_division_id);
CREATE INDEX IF NOT EXISTS idx_movement_slots_club ON movement_slots(club_id) WHERE club_id IS NOT NULL;
