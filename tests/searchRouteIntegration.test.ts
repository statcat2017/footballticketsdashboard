import type { AppDatabase } from "@/lib/db/adapter";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { setupDatabase } from "@/lib/db/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const integrationState = vi.hoisted(() => ({ database: null as AppDatabase | null }));

vi.mock("@/lib/db/client", () => ({
  getDatabase: async () => integrationState.database
}));

vi.mock("@/lib/runtime-env", () => ({
  getEnv: () => undefined,
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
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("api.postcodes.io") || url.includes("api.tfl.gov.uk")) {
      return new Response("{}", { status: 404 });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  }));
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

describe("search HTTP route with isolated SQLite", () => {
  it("applies the 25-mile default and supports all-distance search", async () => {
    const origin = { latitude: 51.4817, longitude: -0.191 };
    const outside = { latitude: origin.latitude + 26 / 69, longitude: origin.longitude };
    await db.run("INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (9901, 'Far Ground', 'XX1 1XX', ?, ?)", [outside.latitude, outside.longitude]);
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      ) VALUES
        ('http-test', 'near', 'PL', 1, 2, 1, '2099-05-15T14:00:00.000Z', 'scheduled', 0, 0),
        ('http-test', 'far', 'PL', 1, 2, 9901, '2099-05-16T14:00:00.000Z', 'scheduled', 0, 0)
    `);

    const defaultResponse = await POST(searchRequest({ postcode: "SW6 1HS" }));
    expect(defaultResponse.status).toBe(200);
    const defaultPayload = await defaultResponse.json();
    expect(defaultPayload.meta).toMatchObject({ radiusMiles: 25, originSource: "known", approximateOrigin: false });
    expect(defaultPayload.results.map((result: { id: number }) => result.id)).toHaveLength(1);

    const allResponse = await POST(searchRequest({ postcode: "SW6 1HS", radiusMiles: "all" }));
    expect(allResponse.status).toBe(200);
    const allPayload = await allResponse.json();
    expect(allPayload.meta.radiusMiles).toBeNull();
    expect(allPayload.results.map((result: { venueName: string }) => result.venueName)).toContain("Far Ground");
  });

  it("requires confirmation before using the approximate area and records that choice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const first = await POST(searchRequest({ postcode: "B75 5AQ" }));
    expect(first.status).toBe(422);
    await expect(first.json()).resolves.toMatchObject({
      code: "postcode_unresolved",
      canUseApproximateOrigin: true
    });

    const confirmed = await POST(searchRequest({ postcode: "B75 5AQ", allowApproximateOrigin: true, radiusMiles: "all" }));
    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      meta: { originSource: "fallback", approximateOrigin: true, radiusMiles: null }
    });
  });

  it("excludes malformed venue coordinates before returning fixtures", async () => {
    await db.run("INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (9902, 'Invalid Ground', 'XX2 2XX', 300, 300)");
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      ) VALUES ('http-test', 'invalid-coordinate', 'PL', 1, 2, 9902, '2099-05-15T14:00:00.000Z', 'scheduled', 0, 0)
    `);

    const response = await POST(searchRequest({ postcode: "SW6 1HS", radiusMiles: "all" }));
    const payload = await response.json();
    expect(payload.results).toEqual([]);
  });
});

function searchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
