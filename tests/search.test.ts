import { afterEach, describe, expect, it, vi } from "vitest";

import type { QueryParam } from "@/lib/db/adapter";
import { createAppDatabase } from "@/lib/db/client";
import type { PostcodeResolver } from "@/lib/postcode";
import { searchFixtures } from "@/lib/search/service";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.POSTCODES_IO_BASE_URL;
});

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe("fixture search", () => {
  it("falls back to unconstrained historical fixtures when date range has no live or historical matches", async () => {
    const db = createAppDatabase();

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-05"
    }, { postcodeResolver: mockResolver });

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.isHistorical).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Historical fixture shown")
        ])
      );
    }
  });

  it("falls back to historical fixtures when no live fixtures match and historical seed data exists", async () => {
    const db = createAppDatabase();

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2025-05-01",
      dateTo: "2025-05-31"
    }, { postcodeResolver: mockResolver });

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.isHistorical).toBe(true);
      expect(result.isDemoData).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Historical fixture shown")
        ])
      );
    }
  });

  it("returns live fixtures sorted by distance when no radius is supplied", async () => {
    const db = createAppDatabase();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES
        ('test', 'chelsea-live', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('test', 'birmingham-live', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
      `);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-15"
    });

    expect(results.map((result) => result.title)).toEqual([
      "Chelsea vs Arsenal",
      "Birmingham City vs Queens Park Rangers"
    ]);
    expect(results.some((result) => result.travel.source === "distance_only")).toBe(true);
    expect(results[0]?.price).toMatchObject({
      saleMode: "all_ticket",
      adultPricePence: 3000,
      concessionPricePence: 2000,
      isOverride: false
    });
  });

  it("prefers fixture price overrides over the club default", async () => {
    const db = createAppDatabase();
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'chelsea-offer', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const fixture = await db.get<{ id: number }>(`
      SELECT id
      FROM fixtures
      WHERE source = 'test' AND source_id = 'chelsea-offer'
    `);

    await db.run(`
      INSERT INTO fixture_ticket_price_overrides (
        fixture_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, note, confidence
      )
      VALUES (?, 'pay_on_gate', 1000, 700, 'https://example.com/non-league-day', '2026-05-11', 'Non League Day offer', 'verified')
    `, [fixture?.id ?? 0]);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
    expect(results[0]?.price).toMatchObject({
      saleMode: "pay_on_gate",
      adultPricePence: 1000,
      concessionPricePence: 700,
      sourceUrl: "https://example.com/non-league-day",
      confidence: "verified",
      isOverride: true,
      overrideNote: "Non League Day offer"
    });
  });

  it("uses exact postcode coordinates and live driving lookup on first search when cache is missing", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("openrouteservice")) {
        return new Response(JSON.stringify({
          routes: [{ summary: { duration: 900 } }]
        }), { status: 200 });
      }

      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'chelsea-b9', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { travelProviders: { openRouteServiceApiKey: "ors-key" } });

    expect(results[0]?.travel.drivingMinutes).toBe(15);
    expect(results[0]?.travel.source).toBe("live");
    expect(results[0]?.travel.publicTransportMinutes).toBeNull();
    expect(results[0]?.travel.publicTransportUrl).toContain("google.com/maps");
    expect(results[0]?.travel.publicTransportUrl).toContain("dir_action=navigate");

    const cached = await db.get<{ provider: string; driving_minutes: number }>(`
      SELECT provider, driving_minutes
      FROM travel_cache
      WHERE postcode_district = 'B9' AND venue_id = 1
    `);

    expect(cached?.provider).toBe("openrouteservice");
    expect(cached?.driving_minutes).toBe(15);
  });
});

describe("travel enrichment resilience", () => {
  it("limits concurrent provider calls to 4", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    let inFlight = 0;
    let maxInFlight = 0;
    let orsCalls = 0;
    let tflCalls = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("openrouteservice")) {
        orsCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight -= 1;
        return new Response(JSON.stringify({
          routes: [{ summary: { duration: 600 } }]
        }), { status: 200 });
      }

      if (url.includes("api.tfl.gov.uk")) {
        tflCalls += 1;
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

    for (const vid of [1, 2, 3, 4, 5, 6]) {
      await db.run(`
        INSERT INTO fixtures (
          source, source_id, competition_code, home_club_id, away_club_id, venue_id,
          kickoff_at, status, is_demo_data, is_historical
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ["test", `conc-${vid}`, "PL", vid, 1, vid, "2026-05-15T19:00:00.000Z", "scheduled", 0, 0]);
    }

    await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { travelProviders: { openRouteServiceApiKey: "ors-key" } });

    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(orsCalls).toBe(6);
    expect(tflCalls).toBe(6);
  });

  it("pre-filters by radius before making provider calls", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    let orsCalls = 0;
    let tflCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("openrouteservice")) {
        orsCalls += 1;
        return new Response(JSON.stringify({
          routes: [{ summary: { duration: 600 } }]
        }), { status: 200 });
      }

      if (url.includes("api.tfl.gov.uk")) {
        tflCalls += 1;
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    // Venue 6 (St Andrew's, B9) is ~0 miles from B9 4RL — in radius
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'radius-in', 'ELC', 6, 4, 6, '2026-05-15T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    // Venue 1 (Stamford Bridge, SW6) is ~100 miles from B9 — out of radius
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'radius-out', 'PL', 1, 2, 1, '2026-05-15T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20",
      radiusMiles: 10
    }, { travelProviders: { openRouteServiceApiKey: "ors-key" } });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Birmingham City vs Queens Park Rangers");
    expect(orsCalls).toBe(1);
    expect(tflCalls).toBe(1);
  });

  it("returns live results when cache write fails", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("openrouteservice")) {
        return new Response(JSON.stringify({
          routes: [{ summary: { duration: 900 } }]
        }), { status: 200 });
      }

      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

    const originalRun = db.run.bind(db);
    vi.spyOn(db, "run").mockImplementation((sql: string, params?: QueryParam[]) => {
      if (sql.includes("INSERT INTO travel_cache")) {
        return Promise.reject(new Error("DB write failed"));
      }
      return originalRun(sql, params);
    });

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'cache-fail', 'PL', 1, 2, 1, '2026-05-15T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { travelProviders: { openRouteServiceApiKey: "ors-key" } });

    expect(results[0]?.travel.drivingMinutes).toBe(15);
    expect(results[0]?.travel.source).toBe("live");
    expect(results[0]?.travel.publicTransportUrl).toContain("google.com/maps");
    expect(results[0]?.travel.publicTransportUrl).toContain("dir_action=navigate");
  });

  it("preserves existing cached travel values when refreshing a partial row", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.includes("openrouteservice")) {
        return new Response(JSON.stringify({
          routes: [{ summary: { duration: 900 } }]
        }), { status: 200 });
      }

      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'partial-cache', 'PL', 1, 2, 1, '2026-05-15T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    await db.run(`
      INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at
      )
      VALUES ('SW6', 1, 4.2, NULL, 45, 'tfl', '2026-05-14T10:00:00.000Z')
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at
    `);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { travelProviders: { openRouteServiceApiKey: "ors-key" } });

    expect(results[0]?.travel.drivingMinutes).toBe(15);
    expect(results[0]?.travel.publicTransportMinutes).toBe(45);
    expect(results[0]?.travel.publicTransportUrl).toBeNull();

    const cached = await db.get<{
      provider: string;
      driving_minutes: number | null;
      public_transport_minutes: number | null;
    }>(`
      SELECT provider, driving_minutes, public_transport_minutes
      FROM travel_cache
      WHERE postcode_district = 'SW6' AND venue_id = 1
    `);

    expect(cached).toEqual({
      provider: "tfl+openrouteservice",
      driving_minutes: 15,
      public_transport_minutes: 45
    });
  });
});
