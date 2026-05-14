import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.POSTCODES_IO_BASE_URL;
});

describe("fixture search", () => {
  it("does not fall back to historical demo fixtures when the live date range is empty", async () => {
    const db = createAppDatabase();

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-05"
    });

    expect(results).toEqual([]);
  });

  it("returns live fixtures sorted by distance when no radius is supplied", async () => {
    const db = createAppDatabase();
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
      isOverride: true
    });
  });

  it("uses exact postcode coordinates and live driving lookup on first search when cache is missing", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      routes: [{ summary: { duration: 900 } }]
    }), { status: 200 })));

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

    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response(JSON.stringify({
        routes: [{ summary: { duration: 600 } }]
      }), { status: 200 });
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
  });

  it("pre-filters by radius before making provider calls", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      routes: [{ summary: { duration: 600 } }]
    }), { status: 200 }));

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns live results when cache write fails", async () => {
    const db = createAppDatabase();
    process.env.OPENROUTESERVICE_API_KEY = "ors-key";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      routes: [{ summary: { duration: 900 } }]
    }), { status: 200 })));

    const originalRun = db.run.bind(db);
    vi.spyOn(db, "run").mockImplementation((sql: string, ...params: unknown[]) => {
      if (sql.includes("INSERT INTO travel_cache")) {
        return Promise.reject(new Error("DB write failed"));
      }
      return originalRun(sql, ...params);
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
  });
});
