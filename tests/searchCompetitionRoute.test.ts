import type { AppDatabase } from "@/lib/db/adapter";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { setupDatabase } from "@/lib/db/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const integrationState = vi.hoisted(() => ({ database: null as AppDatabase | null }));

vi.mock("@/lib/db/client", () => ({
  getDatabase: async () => integrationState.database
}));

vi.mock("@/lib/runtime-env", () => ({
  getTravelProviderRuntimeConfig: async () => ({})
}));

vi.mock("@/lib/date", () => ({
  defaultDateRange: () => ({ dateFrom: "2099-05-10", dateTo: "2099-05-20" })
}));

vi.mock("@/lib/travel/backfill", () => ({
  scheduleSearchTravelBackfill: vi.fn()
}));

import { POST } from "@/app/api/search/route";

let sqlite: Awaited<ReturnType<typeof setupDatabase>> | null = null;
let db: AppDatabase;

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  sqlite = await setupDatabase(":memory:");
  db = createSqliteAppDatabase(sqlite);
  integrationState.database = db;
});

afterEach(() => {
  sqlite?.close();
  sqlite = null;
  integrationState.database = null;
  vi.unstubAllGlobals();
});

describe("competition categories in public search", () => {
  it("returns curated competition categories through the search HTTP route", async () => {
    await db.run(`
      INSERT INTO competitions (code, name, tier, kind, public_category)
      VALUES
        ('TESTCUP', 'Example Cup', 4, 'cup', 'cup'),
        ('TESTWOM', 'Women Premier League Cup', 1, 'cup', 'womens'),
        ('TESTUNK', 'Premier League Reserves', 5, 'league', 'uncategorized')
    `);
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES
        ('http-category', 'pl', 'PL', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'efl', 'ELC', 6, 4, 6, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'non-league', 'NPLP', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'friendly', 'FRIENDLY', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'cup', 'TESTCUP', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'womens', 'TESTWOM', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('http-category', 'unknown', 'TESTUNK', 1, 2, 1, '2099-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const response = await POST(searchRequest({
      postcode: "SW6 1HS",
      dateFrom: "2099-05-10",
      dateTo: "2099-05-15"
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      results: Array<{ competitionCode: string; competitionCategory: string }>;
    };
    expect(payload.results.map(({ competitionCode, competitionCategory }) => [competitionCode, competitionCategory])).toEqual(
      expect.arrayContaining([
        ["PL", "premier-league"],
        ["ELC", "efl"],
        ["NPLP", "non-league"],
        ["FRIENDLY", "friendly"],
        ["TESTCUP", "cup"],
        ["TESTWOM", "womens"],
        ["TESTUNK", "uncategorized"]
      ])
    );
  });
});

function searchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
