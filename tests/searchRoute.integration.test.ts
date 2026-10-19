import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSqliteAppDatabase, type AppDatabase } from "@/lib/db/adapter";
import { setupDatabase } from "@/lib/db/setup";

const getDatabase = vi.fn<() => Promise<AppDatabase>>();
vi.mock("@/lib/db/client", () => ({ getDatabase }));

const dateFrom = "2030-05-10";
const dateTo = "2030-05-20";
let databaseFile: string;
let databaseHandle: Awaited<ReturnType<typeof setupDatabase>> | null = null;
let temporaryDirectory: string;

async function createIsolatedSearchDatabase(): Promise<AppDatabase> {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-search-"));
  databaseFile = path.join(temporaryDirectory, "search.sqlite");
  databaseHandle = await setupDatabase(databaseFile);
  const db = createSqliteAppDatabase(databaseHandle);

  await db.run(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id, venue_id,
      kickoff_at, status, is_demo_data, is_historical
    ) VALUES
      ('integration', 'cached-fixture', 'PL', 1, 2, 4, '2030-05-12T15:00:00.000Z', 'scheduled', 0, 0),
      ('integration', 'uncached-fixture', 'ELC', 6, 4, 6, '2030-05-13T19:00:00.000Z', 'scheduled', 0, 0)
  `);
  await db.run(`
    INSERT INTO travel_cache (
      postcode_district, venue_id, distance_miles, driving_minutes,
      public_transport_minutes, provider, calculated_at
    ) VALUES ('SW6', 4, 4.2, 18, 35, 'fixture-cache', datetime('now'))
    ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
      distance_miles = excluded.distance_miles,
      driving_minutes = excluded.driving_minutes,
      public_transport_minutes = excluded.public_transport_minutes,
      provider = excluded.provider,
      calculated_at = excluded.calculated_at
  `);
  await db.run("DELETE FROM travel_cache WHERE postcode_district = 'SW6' AND venue_id = 6");
  getDatabase.mockResolvedValue(db);
  return db;
}

async function postSearchQuickly() {
  const { POST } = await import("@/app/api/search/route");
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      POST(new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcode: "SW6 1HS", dateFrom, dateTo })
      })),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Search waited for a travel provider.")), 750);
      })
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function assertCachedValuesPersistAfterReopen(db: AppDatabase) {
  const cachedBeforeClose = await db.get<{
    distance_miles: number;
    driving_minutes: number | null;
    public_transport_minutes: number | null;
    provider: string;
  }>(`
    SELECT distance_miles, driving_minutes, public_transport_minutes, provider
    FROM travel_cache WHERE postcode_district = 'SW6' AND venue_id = 4
  `);
  expect(cachedBeforeClose).toEqual({
    distance_miles: 4.2,
    driving_minutes: 18,
    public_transport_minutes: 35,
    provider: "fixture-cache"
  });

  databaseHandle?.close();
  databaseHandle = await setupDatabase(databaseFile);
  const reopenedDb = createSqliteAppDatabase(databaseHandle);
  const cachedAfterReopen = await reopenedDb.get<{
    distance_miles: number;
    driving_minutes: number | null;
    public_transport_minutes: number | null;
    provider: string;
  }>(`
    SELECT distance_miles, driving_minutes, public_transport_minutes, provider
    FROM travel_cache WHERE postcode_district = 'SW6' AND venue_id = 4
  `);
  expect(cachedAfterReopen).toEqual(cachedBeforeClose);
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.TRAVELTIME_APP_ID;
  delete process.env.TRAVELTIME_API_KEY;
  getDatabase.mockReset();
  databaseHandle?.close();
  databaseHandle = null;
  if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("search API travel-provider isolation", () => {
  it("responds with cache and distance-only results while travel providers remain pending", async () => {
    const db = await createIsolatedSearchDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "test-provider-key";
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await postSearchQuickly();
    const payload = await response.json() as {
      results: Array<{ title: string; travel: { source: string; drivingMinutes: number | null; publicTransportUrl: string | null } }>;
    };

    expect(response.status).toBe(200);
    expect(payload.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Chelsea vs Arsenal",
        travel: expect.objectContaining({ source: "cache", drivingMinutes: 18 })
      }),
      expect.objectContaining({
        title: "Birmingham City vs Queens Park Rangers",
        travel: expect.objectContaining({ source: "distance_only", drivingMinutes: null })
      })
    ]));
    const distanceOnly = payload.results.find((result) => result.travel.source === "distance_only");
    expect(distanceOnly?.travel.publicTransportUrl).toContain("google.com/maps");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await assertCachedValuesPersistAfterReopen(db);
  });

  it("responds with cached values when providers fail and leaves cache intact after reopen", async () => {
    const db = await createIsolatedSearchDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "test-provider-key";
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("provider unavailable")));
    vi.stubGlobal("fetch", fetchMock);

    const response = await postSearchQuickly();
    const payload = await response.json() as { results: Array<{ travel: { source: string } }> };

    expect(response.status).toBe(200);
    expect(payload.results.some((result) => result.travel.source === "cache")).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await assertCachedValuesPersistAfterReopen(db);
  });
});

