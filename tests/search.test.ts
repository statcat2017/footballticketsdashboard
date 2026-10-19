import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { QueryParam } from "@/lib/db/adapter";
import { createAppDatabase, createDatabase } from "@/lib/db/client";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
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
    const db = await createAppDatabase();

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

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
    const db = await createAppDatabase();

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("api.tfl.gov.uk")) {
        return new Response(JSON.stringify({ message: "No journey found for your inputs." }), { status: 404 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }));

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
    const db = await createAppDatabase();
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
    const db = await createAppDatabase();
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

  it("does not borrow default price evidence for an undated partial fixture override", async () => {
    const db = await createAppDatabase();
    await db.run(`
      INSERT OR IGNORE INTO fixture_seasons (label, starts_on, ends_on, is_current)
      VALUES ('2026-27', '2026-07-01', '2027-06-30', 1)
    `);
    await db.run("UPDATE club_ticket_prices SET season_label = '2025-26' WHERE club_id = 1");
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, fixture_date, kickoff_time, kickoff_time_status, season_label,
        status, is_demo_data, is_historical
      ) VALUES (
        'test', 'partial-undated-override', 'PL', 1, 2, 1,
        '2026-10-24T15:00:00.000Z', '2026-10-24', '15:00', 'confirmed', '2026-27',
        'scheduled', 0, 0
      )
    `);

    const fixture = await db.get<{ id: number }>(`
      SELECT id FROM fixtures WHERE source = 'test' AND source_id = 'partial-undated-override'
    `);
    await db.run(`
      INSERT INTO fixture_ticket_price_overrides (
        fixture_id, sale_mode, adult_price_pence, concession_price_pence,
        source_url, verified_at, note, confidence, season_label
      ) VALUES (?, 'pay_on_gate', 1250, NULL,
        NULL, NULL, 'Partial override', 'verified', NULL)
    `, [fixture?.id ?? 0]);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-10-24",
      dateTo: "2026-10-25"
    });
    const result = results.find((row) => row.id === fixture?.id);

    expect(result?.price).toMatchObject({
      adultPricePence: 1250,
      concessionPricePence: 2000,
      sourceUrl: null,
      verifiedAt: null,
      confidence: "verified",
      isOverride: true,
      seasonLabel: null,
      confirmation: {
        required: true,
        maxAgeDays: 90,
        reasons: ["missing_checked_date"]
      }
    });
  });

  it("keeps adult override evidence separate from stale club-level concession evidence", async () => {
    const db = await createAppDatabase();
    await db.run(`
      INSERT OR IGNORE INTO fixture_seasons (label, starts_on, ends_on, is_current)
      VALUES ('2026-27', '2026-07-01', '2027-06-30', 1)
    `);
    await db.run("UPDATE club_ticket_prices SET source_url = ?, verified_at = ?, confidence = ?, season_label = ? WHERE club_id = 1", [
      "https://club.example.test/old-prices", "2025-01-10", "verified", "2025-26"
    ]);
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, fixture_date, kickoff_time, kickoff_time_status, season_label,
        status, is_demo_data, is_historical
      ) VALUES (
        'test', 'split-price-evidence', 'PL', 1, 2, 1,
        '2026-10-24T15:00:00.000Z', '2026-10-24', '15:00', 'confirmed', '2026-27',
        'scheduled', 0, 0
      )
    `);
    const fixture = await db.get<{ id: number }>(
      "SELECT id FROM fixtures WHERE source = 'test' AND source_id = 'split-price-evidence'"
    );
    await db.run(`
      INSERT INTO fixture_ticket_price_overrides (
        fixture_id, sale_mode, adult_price_pence, concession_price_pence,
        source_url, verified_at, note, confidence, season_label
      ) VALUES (?, 'pay_on_gate', 1250, NULL,
        'https://club.example.test/current-fixture-price', '2026-10-18', 'Adult price update', 'verified', '2026-27')
    `, [fixture?.id ?? 0]);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-10-24",
      dateTo: "2026-10-24"
    }, {
      postcodeResolver: { resolve: async () => ({ latitude: 51.4817, longitude: -0.191 }) },
      travelProviderOverrides: []
    });
    const result = results.find((row) => row.id === fixture?.id);

    expect(result?.price.adultEvidence).toMatchObject({
      sourceUrl: "https://club.example.test/current-fixture-price",
      verifiedAt: "2026-10-18",
      confidence: "verified",
      seasonLabel: "2026-27",
      isOverride: true,
      confirmation: { required: false, reasons: [] }
    });
    expect(result?.price.concessionEvidence).toMatchObject({
      sourceUrl: "https://club.example.test/old-prices",
      verifiedAt: "2025-01-10",
      confidence: "verified",
      seasonLabel: "2025-26",
      isOverride: false,
      confirmation: {
        required: true,
        reasons: expect.arrayContaining(["older_than_threshold", "different_season"])
      }
    });
  });

  it("preserves fixture price evidence across a persistent-file reopen", async () => {
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "nearmefc-price-reopen-"));
    const filename = path.join(dirname, "prices.sqlite");
    let sqlite = await createDatabase(filename);

    try {
      const db = createSqliteAppDatabase(sqlite);
      await db.run(`
        INSERT INTO fixtures (
          source, source_id, competition_code, home_club_id, away_club_id, venue_id,
          kickoff_at, fixture_date, kickoff_time, kickoff_time_status, season_label,
          status, is_demo_data, is_historical
        ) VALUES ('price-reopen', 'fixture-1', 'PL', 1, 2, 1,
          '2099-06-01T15:00:00.000Z', '2099-06-01', '15:00', 'confirmed', '2025-26',
          'scheduled', 0, 0)
      `);
      const fixture = await db.get<{ id: number }>(
        "SELECT id FROM fixtures WHERE source = 'price-reopen' AND source_id = 'fixture-1'"
      );
      const checkedAt = new Date().toISOString().slice(0, 10);
      await db.run(`
        INSERT INTO fixture_ticket_price_overrides (
          fixture_id, sale_mode, adult_price_pence, concession_price_pence,
          source_url, verified_at, note, confidence, season_label
        ) VALUES (?, 'pay_on_gate', 1250, NULL,
          'https://prices.example.test/reopened-fixture', ?, 'Reopen test', 'verified', '2025-26')
      `, [fixture?.id ?? 0, checkedAt]);

      sqlite.close();
      sqlite = await createDatabase(filename);
      const reopenedDb = createSqliteAppDatabase(sqlite);
      const results = await searchFixtures(reopenedDb, {
        postcode: "SW6 1HS",
        dateFrom: "2099-06-01",
        dateTo: "2099-06-02"
      });
      const result = results.find((row) => row.title === "Chelsea vs Arsenal");

      expect(result?.price).toMatchObject({
        adultPricePence: 1250,
        concessionPricePence: 2000,
        sourceUrl: "https://prices.example.test/reopened-fixture",
        verifiedAt: checkedAt,
        confidence: "verified",
        isOverride: true,
        seasonLabel: "2025-26",
        confirmation: { required: false, maxAgeDays: 90, reasons: [] }
      });
      expect(result?.genericTicketUrl).toBe("https://www.chelseafc.com/en/tickets");
    } finally {
      sqlite.close();
      fs.rmSync(dirname, { recursive: true, force: true });
    }
  });

  it("uses exact postcode coordinates and live driving lookup on first search when cache is missing", async () => {
    const db = await createAppDatabase();
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
    const db = await createAppDatabase();
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
    const db = await createAppDatabase();
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
    const db = await createAppDatabase();
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
    const db = await createAppDatabase();
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
    expect(results[0]?.travel.publicTransportUrl).toContain("google.com/maps");

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
