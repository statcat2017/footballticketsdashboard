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
        (SELECT COUNT(*) FROM travel_cache) as travelRows
    `).get() as {
      competitions: number;
      clubs: number;
      seedFixtures: number;
      travelRows: number;
    };

    second.close();

    expect(fs.existsSync(filename)).toBe(true);
    expect(counts).toEqual({
      competitions: 2,
      clubs: 6,
      seedFixtures: 4,
      travelRows: 6
    });
  });
});
