import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { setupDatabase } from "@/lib/db/setup";

describe("database setup", () => {
  it("creates a SQLite file and can be run repeatedly without duplicating seed rows", () => {
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-db-"));
    const filename = path.join(dirname, "nearmefc.sqlite");

    const first = setupDatabase(filename);
    first.close();

    const second = setupDatabase(filename);
    const counts = second.prepare(`
      SELECT
        (SELECT COUNT(*) FROM competitions) as competitions,
        (SELECT COUNT(*) FROM clubs) as clubs,
        (SELECT COUNT(*) FROM fixtures WHERE source = 'historical_seed') as seedFixtures,
        (SELECT COUNT(*) FROM travel_cache) as travelRows,
        (SELECT COUNT(*) FROM pyramid_templates) as pyramidTemplates,
        (SELECT COUNT(*) FROM pyramid_divisions) as pyramidDivisions,
        (SELECT COUNT(*) FROM pyramid_edges) as pyramidEdges,
        (SELECT COUNT(*) FROM pyramid_seasons) as pyramidSeasons,
        (SELECT COUNT(*) FROM pyramid_season_divisions) as pyramidSeasonDivisions,
        (SELECT COUNT(*) FROM admin_audit_log) as adminAuditRows
    `).get() as {
      competitions: number;
      clubs: number;
      seedFixtures: number;
      travelRows: number;
      pyramidTemplates: number;
      pyramidDivisions: number;
      pyramidEdges: number;
      pyramidSeasons: number;
      pyramidSeasonDivisions: number;
      adminAuditRows: number;
    };

    const pyramidDivision = second.prepare(`
      SELECT status, locked_at
      FROM pyramid_season_divisions
      ORDER BY id
      LIMIT 1
    `).get() as { status: string; locked_at: string | null };

    second.close();

    expect(fs.existsSync(filename)).toBe(true);
    expect(counts).toEqual({
      competitions: 2,
      clubs: 6,
      seedFixtures: 4,
      travelRows: 6,
      pyramidTemplates: 1,
      pyramidDivisions: 52,
      pyramidEdges: 129,
      pyramidSeasons: 1,
      pyramidSeasonDivisions: 52,
      adminAuditRows: 0
    });
    expect(pyramidDivision).toEqual({ status: "open", locked_at: null });
  });
});
