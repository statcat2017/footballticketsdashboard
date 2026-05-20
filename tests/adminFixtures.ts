import Database from "better-sqlite3";

import { createSqliteAppDatabase, type AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";

type AdminFixtureOptions = {
  includeAlbionGroundshare?: boolean;
  includePreviousSeason?: boolean;
  roversPrimary?: boolean;
};

export function createTestAppDatabase(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  return createSqliteAppDatabase(sqlite);
}

export function createAdminFixtureDatabase(options: AdminFixtureOptions = {}): AppDatabase {
  const db = createTestAppDatabase();
  const seasons = options.includePreviousSeason
    ? "(1, 1, '2024-25'), (2, 1, '2025-26')"
    : "(1, 1, '2025-26')";
  const albionClub = options.includeAlbionGroundshare
    ? ",\n      (103, 'Albion FC', 'known')"
    : "";
  const albionDivisionAssignment = options.includeAlbionGroundshare
    ? ",\n      (103, 10)"
    : "";
  const albionVenueAssignment = options.includeAlbionGroundshare
    ? ",\n      (103, 103, 50, '2025-08-01', NULL, 1)"
    : "";

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');

    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES
      (10, 1, 'premier', 'Premier Division', 1, 20),
      (11, 1, 'first', 'First Division', 2, 24);

    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES ${seasons};

    INSERT INTO clubs (id, name, status) VALUES
      (100, 'Test Town United', 'known'),
      (101, 'City Athletic', 'known'),
      (102, 'Rovers FC', 'partial')${albionClub};

    INSERT INTO division_assignments (club_id, division_id) VALUES
      (100, 10),
      (101, 10),
      (102, 11)${albionDivisionAssignment};

    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES
      (50, 'Test Park', 'TE1 1ST', 51.5, -0.1),
      (51, 'City Ground', 'CT1 2AB', 52.0, -0.2),
      (52, 'Rovers Stadium', 'RV1 3CD', 53.0, -0.3);

    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES
      (100, 100, 50, '2025-08-01', NULL, 1),
      (101, 101, 51, '2025-08-01', NULL, 1),
      (102, 102, 52, '2025-08-01', NULL, ${options.roversPrimary ? 1 : 0})${albionVenueAssignment};
  `);

  return db;
}
