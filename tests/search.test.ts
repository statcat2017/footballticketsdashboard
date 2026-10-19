import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("returns straight-line distance and a public transport link when cache is missing without calling providers", async () => {
    const db = await createAppDatabase();
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("search must not call travel providers")));
    vi.stubGlobal("fetch", fetchMock);

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'distance-only', 'ELC', 6, 4, 6, '2030-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2030-05-10",
      dateTo: "2030-05-20"
    });

    expect(results[0]?.travel).toMatchObject({
      source: "distance_only",
      drivingMinutes: null,
      publicTransportMinutes: null,
      isPartial: false,
      isStale: false,
      isDistrictApproximate: false,
      postcodeDistrict: "B9"
    });
    expect(results[0]?.travel.publicTransportUrl).toContain("google.com/maps");
    expect(results[0]?.warnings).toContain("Travel time unavailable for this postcode district; showing straight-line distance only.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns cached travel values without changing partial cache rows", async () => {
    const db = await createAppDatabase();
    const calculatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'partial-cache', 'PL', 1, 2, 1, '2030-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);
    await db.run(`
      INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at
      ) VALUES ('SW6', 1, 4.2, NULL, 45, 'tfl', ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at
    `, [calculatedAt]);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2030-05-10",
      dateTo: "2030-05-20"
    });

    expect(results[0]?.travel).toMatchObject({
      source: "cache",
      distanceMiles: 4.2,
      drivingMinutes: null,
      publicTransportMinutes: 45,
      publicTransportUrl: expect.stringContaining("google.com/maps"),
      postcodeDistrict: "SW6",
      isDistrictApproximate: true,
      isPartial: true,
      isStale: false,
      calculatedAt
    });

    const cached = await db.get<{ driving_minutes: number | null; public_transport_minutes: number | null; calculated_at: string }>(`
      SELECT driving_minutes, public_transport_minutes, calculated_at
      FROM travel_cache WHERE postcode_district = 'SW6' AND venue_id = 1
    `);
    expect(cached).toEqual({ driving_minutes: null, public_transport_minutes: 45, calculated_at: calculatedAt });
  });

  it("marks cached travel older than 30 days as stale", async () => {
    const db = await createAppDatabase();
    const calculatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'stale-cache', 'PL', 1, 2, 1, '2030-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);
    await db.run(`
      INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at
      ) VALUES ('SW6', 1, 4.2, 15, 45, 'seed', ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at
    `, [calculatedAt]);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2030-05-10",
      dateTo: "2030-05-20"
    });

    expect(results[0]?.travel.isStale).toBe(true);
    expect(results[0]?.warnings).toContain("Travel estimate may be out of date.");
  });
});
