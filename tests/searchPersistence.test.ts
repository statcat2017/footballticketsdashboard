import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { setupDatabase } from "@/lib/db/setup";
import { searchFixtures } from "@/lib/search/service";
import type { TravelProvider } from "@/lib/travel/providers";

const temporaryDirectories: string[] = [];
const openDatabases: SqliteDatabase[] = [];

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("search travel-cache persistence", () => {
  it("reopens cached district travel data while returning exact origin distance", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-search-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "fixtures.sqlite");
    const sqlite = await setupDatabase(databasePath);
    openDatabases.push(sqlite);
    const db = createSqliteAppDatabase(sqlite);

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      ) VALUES ('search-persistence', 'fixture-1', 'PL', 1, 2, 1,
        '2026-05-15T14:00:00.000Z', 'scheduled', 0, 0)
    `);

    const provider: TravelProvider = {
      estimate: async () => ({ drivingMinutes: 30, publicTransportMinutes: null, provider: "mock-travel" })
    };
    const results = await searchFixtures(db, {
      postcode: "X1 1XX",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: { resolve: async () => ({ latitude: 51.4817, longitude: -0.191 }) },
      travelProviderOverrides: [provider]
    });

    expect(results[0]?.travel.distanceMiles).toBe(0);
    expect(results[0]?.travel.drivingMinutes).toBe(30);
    sqlite.close();
    openDatabases.splice(openDatabases.indexOf(sqlite), 1);

    const reopened = new Database(databasePath);
    openDatabases.push(reopened);
    const cached = reopened.prepare(`
      SELECT postcode_district, venue_id, driving_minutes, public_transport_minutes, provider
      FROM travel_cache WHERE postcode_district = 'X1' AND venue_id = 1
    `).get();
    expect(cached).toEqual({
      postcode_district: "X1",
      venue_id: 1,
      driving_minutes: 30,
      public_transport_minutes: null,
      provider: "mock-travel"
    });
    expect(reopened.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
  });
});
