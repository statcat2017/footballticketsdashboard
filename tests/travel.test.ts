import { describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { fillTravelCacheForGroundDistricts, fillTravelCacheForPostcode } from "@/lib/travel/cache";
import {
  lookupOpenRouteServiceDrivingMinutes,
  lookupTravelEstimate,
  lookupTravelTimePublicTransportMinutes
} from "@/lib/travel/providers";

describe("travel provider integrations", () => {
  it("parses OpenRouteService driving durations", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      routes: [
        {
          summary: {
            duration: 1860
          }
        }
      ]
    }), { status: 200 }));

    await expect(lookupOpenRouteServiceDrivingMinutes(
      { latitude: 51.48, longitude: -0.19 },
      { latitude: 51.55, longitude: -0.11 },
      "ors-key",
      fetchImpl as typeof fetch
    )).resolves.toBe(31);
  });

  it("parses TravelTime public transport durations", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      results: [
        {
          locations: [
            {
              properties: [
                {
                  travel_time: 2580
                }
              ]
            }
          ]
        }
      ]
    }), { status: 200 }));

    await expect(lookupTravelTimePublicTransportMinutes(
      { latitude: 51.48, longitude: -0.19 },
      { latitude: 51.55, longitude: -0.11 },
      "app-id",
      "travel-key",
      fetchImpl as typeof fetch
    )).resolves.toBe(43);
  });

  it("falls back cleanly when provider keys are missing", async () => {
    const fetchImpl = vi.fn();

    await expect(lookupTravelEstimate(
      { latitude: 51.48, longitude: -0.19 },
      { latitude: 51.55, longitude: -0.11 },
      {},
      fetchImpl as typeof fetch
    )).resolves.toEqual({
      drivingMinutes: null,
      publicTransportMinutes: null,
      provider: null
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back cleanly when one provider fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limit", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          {
            locations: [
              {
                properties: [
                  {
                    travel_time: 2400
                  }
                ]
              }
            ]
          }
        ]
      }), { status: 200 }));

    await expect(lookupTravelEstimate(
      { latitude: 51.48, longitude: -0.19 },
      { latitude: 51.55, longitude: -0.11 },
      {
        openRouteServiceApiKey: "ors-key",
        travelTimeAppId: "app-id",
        travelTimeApiKey: "travel-key"
      },
      fetchImpl as typeof fetch
    )).resolves.toEqual({
      drivingMinutes: null,
      publicTransportMinutes: 40,
      provider: "traveltime"
    });
  });
});

describe("travel cache fill command path", () => {
  it("fills missing travel cache rows for upcoming venues", async () => {
    const db = createAppDatabase();
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES
        ('test', 'travel-chelsea', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('test', 'travel-norwich', 'ELC', 5, 4, 5, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        routes: [{ summary: { duration: 600 } }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ locations: [{ properties: [{ travel_time: 900 }] }] }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        routes: [{ summary: { duration: 7200 } }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ locations: [{ properties: [{ travel_time: 8100 }] }] }]
      }), { status: 200 }));

    const result = await fillTravelCacheForPostcode(db, "NR1 1JE", {
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20",
      openRouteServiceApiKey: "ors-key",
      travelTimeAppId: "app-id",
      travelTimeApiKey: "travel-key",
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result).toMatchObject({
      postcodeDistrict: "NR1",
      venuesConsidered: 2,
      rowsInserted: 2,
      providerBackfilled: 2,
      distanceOnlySkipped: 0
    });

    const rows = await db.all<{
      postcode_district: string;
      venue_id: number;
      provider: string;
      driving_minutes: number | null;
      public_transport_minutes: number | null;
    }>(`
      SELECT postcode_district, venue_id, provider, driving_minutes, public_transport_minutes
      FROM travel_cache
      WHERE postcode_district = 'NR1'
      ORDER BY venue_id ASC
    `);

    expect(rows).toEqual([
      {
        postcode_district: "NR1",
        venue_id: 1,
        provider: "openrouteservice+traveltime",
        driving_minutes: 10,
        public_transport_minutes: 15
      },
      {
        postcode_district: "NR1",
        venue_id: 5,
        provider: "openrouteservice+traveltime",
        driving_minutes: 120,
        public_transport_minutes: 135
      }
    ]);
  });

  it("skips writes when no provider credentials are available", async () => {
    const db = createAppDatabase();
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'travel-birmingham', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const result = await fillTravelCacheForPostcode(db, "B9 4RL", {
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(result).toMatchObject({
      postcodeDistrict: "B9",
      venuesConsidered: 1,
      rowsInserted: 0,
      providerBackfilled: 0,
      distanceOnlySkipped: 1
    });

    const row = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM travel_cache
      WHERE postcode_district = 'B9'
    `);

    expect(row?.count).toBe(0);
  });

  it("prewarms every known ground district against all venues", async () => {
    const db = createAppDatabase();
    const before = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM travel_cache
    `);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({
        routes: [{ summary: { duration: 600 } }]
      }), { status: 200 }));

    const result = await fillTravelCacheForGroundDistricts(db, {
      openRouteServiceApiKey: "ors-key",
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.districtsConsidered).toBeGreaterThan(0);
    expect(result.rowsInserted).toBeGreaterThan(0);

    const after = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM travel_cache
    `);

    expect(after?.count).toBeGreaterThan(before?.count ?? 0);
  });
});
