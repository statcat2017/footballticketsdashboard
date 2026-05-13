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
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
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
      dateTo: "2026-05-20"
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
    process.env.POSTCODES_IO_BASE_URL = "https://postcodes.test";

    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: {
          latitude: 52.549,
          longitude: -1.816
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        routes: [
          {
            summary: {
              duration: 900
            }
          }
        ]
      }), { status: 200 })));

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'chelsea-b75', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "B75 5AQ",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results[0]?.travel.drivingMinutes).toBeNull();
    expect(results[0]?.travel.source).toBe("distance_only");

    const cached = await db.get<{ provider: string; driving_minutes: number }>(`
      SELECT provider, driving_minutes
      FROM travel_cache
      WHERE postcode_district = 'B75' AND venue_id = 1
    `);

    expect(cached).toBeUndefined();
  });
});
