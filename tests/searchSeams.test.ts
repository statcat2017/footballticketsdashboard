import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";
import type { PostcodeResolver } from "@/lib/postcode";
import type { TravelProvider } from "@/lib/travel/providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("search service substitutable seams", () => {
  it("accepts a mock PostcodeResolver override", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-chelsea', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { postcodeResolver: mockResolver });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
  });

  it("accepts a mock TravelProvider override", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-travel', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const mockTravel: TravelProvider = {
      name: "mock-driving",
      estimate: async () => ({
        drivingMinutes: 45,
        publicTransportMinutes: null,
        provider: "mock-driving"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [mockTravel]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(45);
    expect(results[0]?.travel.source).toBe("live");
  });

  it("combines multiple mock TravelProviders", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-multi', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const mockDriving: TravelProvider = {
      name: "mock-driving",
      estimate: async () => ({
        drivingMinutes: 30,
        publicTransportMinutes: null,
        provider: "mock-driving"
      })
    };

    const mockTransit: TravelProvider = {
      name: "mock-transit",
      estimate: async () => ({
        drivingMinutes: null,
        publicTransportMinutes: 60,
        provider: "mock-transit"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [mockDriving, mockTransit]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(30);
    expect(results[0]?.travel.publicTransportMinutes).toBe(60);
  });

  it("falls back to default PostcodeResolver when none provided", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-fallback', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
  });
});
